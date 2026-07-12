import { Api } from "@/lib/api";
import { hashPassword, hashToken } from "@/lib/auth";
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
      RESET_PASSWORD_RATE_WINDOW_MS,
    );
    if (!rateLimit.success) {
      logger.warn("auth.reset_password.rate_limited", { requestId });
      return Api.tooManyRequests(
        "Too many attempts. Try again later.",
        (rateLimit.resetAt - Date.now()) / 1000,
      );
    }

    const body = await req.json().catch(() => null);
    const validation = ResetPasswordSchema.safeParse(body);

    if (!validation.success) {
      return Api.badRequest(
        "Invalid password reset details",
        validation.error.format(),
      );
    }

    const { token, password } = validation.data;
    const tokenHash = hashToken(token);
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            status: true,
            invitedById: true,
          },
        },
      },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= new Date()
    ) {
      return Api.badRequest("This reset link is invalid or expired");
    }

    const user = resetToken.user;
    const { passwordHash } = hashPassword(password);
    const consumedAt = new Date();

    // Determine whether this reset should also activate the user.
    // Invited users (invitedById set) completing their first password setup
    // are self-approving via the invite flow — flip PENDING_APPROVAL → ACTIVE.
    // Self-signup users going through forgot-password do NOT get status changed.
    const isInviteCompletion =
      user.invitedById !== null && user.status === "PENDING_APPROVAL";

    const transactionResult = await prisma.$transaction(async (tx) => {
      // Consume the token atomically — double-submit protection.
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: consumedAt },
        },
        data: { usedAt: consumedAt },
      });

      if (consumed.count !== 1) return { consumed: false };

      // Update the user's password (and optionally activate invited users).
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          ...(isInviteCompletion
            ? {
                status: "ACTIVE",
                approvedAt: consumedAt,
                // approvedById is null — self-approved via invite flow.
              }
            : {}),
        },
      });

      // Invalidate all existing sessions — force re-login with new password.
      await tx.authSession.deleteMany({
        where: { userId: resetToken.userId },
      });

      return { consumed: true };
    });

    if (!transactionResult.consumed) {
      return Api.badRequest("This reset link is invalid or expired");
    }

    logger.info("auth.reset_password", {
      requestId,
      userId: user.id,
      inviteCompleted: isInviteCompletion,
    });

    return Api.ok({
      message: isInviteCompletion
        ? "Password set and account activated. You can now sign in."
        : "Password updated successfully. Please sign in with your new password.",
    });
  } catch (error) {
    logger.error("auth.reset_password.failed", error, { requestId });
    return Api.internalError("Failed to reset password");
  }
}
