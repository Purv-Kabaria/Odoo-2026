import { randomBytes } from "crypto";

import { Api } from "@/lib/api";
import { getCurrentUser, hashToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { InviteUserSchema } from "@/types/auth-types";

const INVITE_RATE_LIMIT = 20;
const INVITE_RATE_WINDOW_MS = 60 * 60 * 1000;
const INVITE_TOKEN_TTL_HOURS = 48;

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const rateLimit = await checkRateLimit(
      `invite:${getClientIp(req)}`,
      INVITE_RATE_LIMIT,
      INVITE_RATE_WINDOW_MS,
    );
    if (!rateLimit.success) {
      logger.warn("users.invite.rate_limited", { requestId });
      return Api.tooManyRequests(
        "Too many invites sent. Try again later.",
        (rateLimit.resetAt - Date.now()) / 1000,
      );
    }

    const actor = await getCurrentUser();
    if (!actor) {
      return Api.unauthorized();
    }

    // Require ADMIN role for inviting users
    try {
      requireRole(actor, "ADMIN");
    } catch {
      return Api.forbidden("Only administrators can invite users");
    }

    const body = await req.json().catch(() => null);
    const validation = InviteUserSchema.safeParse(body);

    if (!validation.success) {
      return Api.badRequest("Invalid invite details", validation.error.format());
    }

    const { email, name, role, departmentId } = validation.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return Api.conflict("A user with this email already exists");
    }

    // If departmentId is provided, verify it exists and belongs to the same organization
    if (departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: departmentId, orgId: actor.orgId },
        select: { id: true },
      });
      if (!dept) {
        return Api.badRequest("Department not found in this organization");
      }
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(
      Date.now() + INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    );

    const result = await prisma.$transaction(async (tx) => {
      // Create user with invitedById and PENDING_APPROVAL status, no passwordHash
      const newUser = await tx.user.create({
        data: {
          orgId: actor.orgId,
          email,
          name,
          role,
          status: "PENDING_APPROVAL",
          departmentId: departmentId || null,
          invitedById: actor.id,
          invitedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          departmentId: true,
        },
      });

      // Create a password reset/setup token linked to the user
      await tx.passwordResetToken.create({
        data: {
          userId: newUser.id,
          tokenHash,
          expiresAt,
        },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          orgId: actor.orgId,
          actorId: actor.id,
          action: "USER_INVITED",
          entityType: "User",
          entityId: newUser.id,
          metadata: {
            invitedEmail: email,
            invitedRole: role,
            departmentId: departmentId || null,
          },
        },
      });

      return newUser;
    });

    const setupUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

    logger.info("users.invited", {
      requestId,
      actorId: actor.id,
      invitedUserId: result.id,
    });

    return Api.created({
      message: "Invitation sent successfully",
      user: result,
      // Dev-only helper: expose setup link so smoke test script can complete the invite
      setupUrl: env.NODE_ENV === "production" ? null : setupUrl,
    });
  } catch (error) {
    logger.error("users.invite.failed", error, { requestId });
    return Api.internalError("Failed to invite user");
  }
}
