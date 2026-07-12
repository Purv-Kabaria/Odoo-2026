import { Api } from "@/lib/api";
import { createSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { LoginSchema } from "@/types/auth-types";

const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW_MS = 5 * 60 * 1000;

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const rateLimit = await checkRateLimit(
      `login:${getClientIp(req)}`,
      LOGIN_RATE_LIMIT,
      LOGIN_RATE_WINDOW_MS,
    );
    if (!rateLimit.success) {
      logger.warn("auth.login.rate_limited", { requestId });
      return Api.tooManyRequests(
        "Too many login attempts. Try again shortly.",
        (rateLimit.resetAt - Date.now()) / 1000,
      );
    }

    const body = await req.json().catch(() => null);
    const validation = LoginSchema.safeParse(body);

    if (!validation.success) {
      return Api.badRequest("Invalid login details", validation.error.format());
    }

    const { email, password, rememberMe } = validation.data;
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        orgId: true,
        departmentId: true,
        passwordHash: true,
      },
    });

    // Check credentials first — don't leak whether the email exists via
    // status-specific messages if the password is wrong.
    if (!user?.passwordHash || !verifyPassword(password, { passwordHash: user.passwordHash })) {
      return Api.unauthorized("Invalid email or password");
    }

    // Status-specific rejection messages (only reached after valid credentials).
    if (user.status === "PENDING_APPROVAL") {
      return Api.unauthorized(
        "Your account is pending administrator approval. Please check back later.",
      );
    }

    if (user.status === "INACTIVE") {
      return Api.unauthorized(
        "Your account has been deactivated. Contact an administrator.",
      );
    }

    // Only ACTIVE users get a session.
    const session = await createSession(user.id, rememberMe);
    logger.info("auth.login", { requestId, userId: user.id });

    const response = Api.ok({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        orgId: user.orgId,
        departmentId: user.departmentId,
      },
    });
    setSessionCookie(response, session.token, session.expiresAt);

    return response;
  } catch (error) {
    logger.error("auth.login.failed", error, { requestId });
    return Api.internalError("Failed to sign in");
  }
}
