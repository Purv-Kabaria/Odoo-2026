import { hashPassword, hashToken } from "@/lib/auth";
import { Api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { ResetPasswordSchema } from "@/types/auth-types";

const RESET_PASSWORD_RATE_LIMIT = 10;
const RESET_PASSWORD_RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const rateLimit = await checkRateLimit(
      `reset-password:${getClientIp(req)}`,
      RESET_PASSWORD_RATE_LIMIT,
      RESET_PASSWORD_RATE_WINDOW_MS
    );
    if (!rateLimit.success) {
      logger.warn("auth.reset_password.rate_limited", { requestId });
      return Api.tooManyRequests(
        "Too many attempts. Try again later.",
        (rateLimit.resetAt - Date.now()) / 1000
      );
    }

    const body = await req.json().catch(() => null);
    const validation = ResetPasswordSchema.safeParse(body);

    if (!validation.success) {
      return Api.badRequest("Invalid password reset details", validation.error.format());
    }

    const { token, password } = validation.data;
    const tokenHash = hashToken(token);
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      return Api.badRequest("This reset link is invalid or expired");
    }

    const { passwordHash } = hashPassword(password);
    const consumedAt = new Date();
    const transactionResult = await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: consumedAt },
        },
        data: { usedAt: consumedAt },
      });

      if (consumed.count !== 1) return { consumed: false };

      // Setting a password IS accepting an invite: a still-pending user
      // (admin-invited, no password) is promoted to Active in the same
      // step. Password must be written first — the DB check constraint
      // (passwordHash IS NOT NULL OR status = 'PENDING_APPROVAL') is
      // evaluated per-statement, not deferred, so flipping status to
      // Active before passwordHash is set would violate it.
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });
      await tx.user.updateMany({
        where: { id: resetToken.userId, status: 'PENDING_APPROVAL' },
        data: { status: 'ACTIVE' },
      });
      await tx.authSession.deleteMany({
        where: { userId: resetToken.userId },
      });

      return { consumed: true };
    });

    if (!transactionResult.consumed) {
      return Api.badRequest("This reset link is invalid or expired");
    }

    logger.info("auth.reset_password", { requestId, userId: resetToken.userId });
    return Api.ok({ message: "Password updated successfully" });
  } catch (error) {
    logger.error("auth.reset_password.failed", error, { requestId });
    return Api.internalError("Failed to reset password");
  }
}
