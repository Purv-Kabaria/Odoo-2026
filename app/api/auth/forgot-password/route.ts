import { randomBytes } from "crypto";

import { Api } from "@/lib/api";
import { hashToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { ForgotPasswordSchema } from "@/types/auth-types";

const RESET_TOKEN_TTL_MINUTES = 30;
const FORGOT_PASSWORD_RATE_LIMIT = 5;
const FORGOT_PASSWORD_RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const rateLimit = await checkRateLimit(
      `forgot-password:${getClientIp(req)}`,
      FORGOT_PASSWORD_RATE_LIMIT,
      FORGOT_PASSWORD_RATE_WINDOW_MS
    );
    if (!rateLimit.success) {
      logger.warn("auth.forgot_password.rate_limited", { requestId });
      return Api.tooManyRequests(
        "Too many requests. Try again later.",
        (rateLimit.resetAt - Date.now()) / 1000
      );
    }

    const body = await req.json().catch(() => null);
    const validation = ForgotPasswordSchema.safeParse(body);

    if (!validation.success) {
      return Api.badRequest("Invalid email address", validation.error.format());
    }

    const { email } = validation.data;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    let resetUrl: string | null = null;

    if (user) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

      logger.info("auth.forgot_password.created", { requestId, email: user.email });
    } else {
      logger.info("auth.forgot_password.missed", { requestId });
    }

    return Api.ok({
      message: "If an account exists for that email, a reset link has been sent.",
      resetUrl: env.NODE_ENV === "production" ? null : resetUrl,
    });
  } catch (error) {
    logger.error("auth.forgot_password.failed", error, { requestId });
    return Api.internalError("Unable to request password reset");
  }
}
