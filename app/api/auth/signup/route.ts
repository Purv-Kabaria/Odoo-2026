import { Api } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { SignupSchema } from "@/types/auth-types";

const SIGNUP_RATE_LIMIT = 5;
const SIGNUP_RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const rateLimit = await checkRateLimit(
      `signup:${getClientIp(req)}`,
      SIGNUP_RATE_LIMIT,
      SIGNUP_RATE_WINDOW_MS,
    );
    if (!rateLimit.success) {
      logger.warn("auth.signup.rate_limited", { requestId });
      return Api.tooManyRequests(
        "Too many signup attempts. Try again later.",
        (rateLimit.resetAt - Date.now()) / 1000,
      );
    }

    const body = await req.json().catch(() => null);
    const validation = SignupSchema.safeParse(body);

    if (!validation.success) {
      return Api.badRequest(
        "Invalid signup details",
        validation.error.format(),
      );
    }

    const { name, email, password, orgSlug } = validation.data;

    // Look up the organization by slug — orgs are provisioned out-of-band.
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
      select: { id: true },
    });

    if (!org) {
      return Api.badRequest("Organization not found");
    }

    const passwordHash = hashPassword(password);

    const user = await prisma.user.create({
      data: {
        orgId: org.id,
        name,
        email,
        passwordHash,
        role: "EMPLOYEE",
        status: "PENDING_APPROVAL",
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    logger.info("auth.signup", { requestId, userId: user.id, orgId: org.id });

    // No session issued — user must be approved by an admin first.
    return Api.created({
      message: "Account created. An administrator must approve your account before you can sign in.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return Api.conflict("An account with this email already exists");
    }

    logger.error("auth.signup.failed", error, { requestId });
    return Api.internalError("Failed to create account");
  }
}
