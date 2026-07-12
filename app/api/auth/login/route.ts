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
    const rateLimit = await checkRateLimit(`login:${getClientIp(req)}`, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS);
    if (!rateLimit.success) {
      logger.warn("auth.login.rate_limited", { requestId });
      return Api.tooManyRequests("Too many login attempts. Try again shortly.", (rateLimit.resetAt - Date.now()) / 1000);
    }

    const body = await req.json().catch(() => null);
    const validation = LoginSchema.safeParse(body);

    if (!validation.success) {
      return Api.badRequest("Invalid login details", validation.error.format());
    }

    const { email, password, rememberMe } = validation.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash || !verifyPassword(password, { passwordHash: user.passwordHash })) {
      return Api.unauthorized("Invalid email or password");
    }

    if (user.status === "INACTIVE") {
      return Api.unauthorized("This account has been deactivated");
    }

    const session = await createSession(user.id, rememberMe);
    logger.info("auth.login", { requestId, userId: user.id });

    const response = Api.ok({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
    setSessionCookie(response, session.token, session.expiresAt);

    return response;
  } catch (error) {
    logger.error("auth.login.failed", error, { requestId });
    return Api.internalError("Failed to sign in");
  }
}
