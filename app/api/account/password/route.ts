import { cookies } from "next/headers";

import { Api } from "@/lib/api";
import {
  getCurrentUser,
  hashPassword,
  hashToken,
  verifyPassword,
} from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";
import { ChangePasswordSchema } from "@/types/auth-types";

const CHANGE_PASSWORD_RATE_LIMIT = 10;
const CHANGE_PASSWORD_RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const rateLimit = await checkRateLimit(
      `account-password:${getClientIp(req)}`,
      CHANGE_PASSWORD_RATE_LIMIT,
      CHANGE_PASSWORD_RATE_WINDOW_MS,
    );
    if (!rateLimit.success) {
      logger.warn("account.password_change.rate_limited", {
        requestId,
        userId: user.id,
      });
      return Api.tooManyRequests(
        "Too many attempts. Try again later.",
        (rateLimit.resetAt - Date.now()) / 1000,
      );
    }

    const body = await req.json().catch(() => null);
    const validation = ChangePasswordSchema.safeParse(body);
    if (!validation.success) {
      return Api.badRequest(
        "Invalid password change request",
        validation.error.format(),
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (
      !currentUser?.passwordHash ||
      !verifyPassword(validation.data.currentPassword, { passwordHash: currentUser.passwordHash })
    ) {
      return Api.badRequest("Current password is incorrect");
    }

    const cookieStore = await cookies();
    const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const currentTokenHash = currentToken ? hashToken(currentToken) : null;
    const { passwordHash } = hashPassword(validation.data.password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      // Keep the current session alive, sign out every other device/session.
      prisma.authSession.deleteMany({
        where: {
          userId: user.id,
          ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
        },
      }),
    ]);

    logger.info("account.password_changed", { requestId, userId: user.id });
    return Api.ok({ message: "Password updated" });
  } catch (error) {
    logger.error("account.password_change.failed", error, { requestId });
    return Api.internalError("Failed to change password");
  }
}
