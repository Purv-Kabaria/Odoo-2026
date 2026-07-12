import { randomBytes } from "crypto";

import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser, hashToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireRole, ForbiddenError } from "@/lib/rbac";
import { InviteUserSchema } from "@/types/auth-types";

// Invite links live much longer than a password-reset link (30 min) since
// they're often not opened same-day — an invitee checking email a few days
// later shouldn't hit a dead link.
const INVITE_TOKEN_TTL_DAYS = 7;
const INVITE_RATE_LIMIT = 20;
const INVITE_RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    try {
      requireRole(user, "ADMIN");
    } catch (error) {
      if (error instanceof ForbiddenError) return Api.forbidden(error.message);
      throw error;
    }

    const rateLimit = await checkRateLimit(
      `users-invite:${getClientIp(req)}`,
      INVITE_RATE_LIMIT,
      INVITE_RATE_WINDOW_MS,
    );
    if (!rateLimit.success) {
      logger.warn("users.invite.rate_limited", { requestId, actorId: user.id });
      return Api.tooManyRequests(
        "Too many invites sent. Try again later.",
        (rateLimit.resetAt - Date.now()) / 1000,
      );
    }

    const body = await req.json().catch(() => null);
    const validation = InviteUserSchema.safeParse(body);
    if (!validation.success) {
      return Api.badRequest("Invalid invite details", validation.error.format());
    }
    const { email, name, role, departmentId } = validation.data;

    if (departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, orgId: user.orgId },
      });
      if (!department) return Api.badRequest("Department not found");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return Api.conflict("A user with this email already exists");

    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invited = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          orgId: user.orgId,
          email,
          name,
          role,
          departmentId: departmentId ?? null,
          status: "PENDING_APPROVAL",
          passwordHash: null,
          invitedById: user.id,
          invitedAt: new Date(),
        },
      });
      await tx.passwordResetToken.create({
        data: { userId: created.id, tokenHash, expiresAt },
      });
      return created;
    });

    const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

    void recordActivityEvent({
      orgId: user.orgId,
      action: "user.invited",
      actorId: user.id,
      entityType: "user",
      entityId: invited.id,
      metadata: { role },
    });
    logger.info("users.invite", { requestId, actorId: user.id, invitedId: invited.id });

    return Api.created({
      id: invited.id,
      email: invited.email,
      name: invited.name,
      role: invited.role,
      status: invited.status,
      // Same dev-only disclosure pattern as forgot-password — a real deploy
      // sends this via email instead of returning it in the response.
      inviteUrl: env.NODE_ENV === "production" ? null : inviteUrl,
    });
  } catch (error) {
    logger.error("users.invite.failed", error, { requestId });
    return Api.internalError("Failed to send invite");
  }
}
