import { Api } from '@/lib/api';
import { createSession, hashPassword, setSessionCookie } from '@/lib/auth';
import { usersEntityConfig } from '@/lib/entities/users';
import { logger } from '@/lib/logger';
import { upsertInSearch } from '@/lib/meilisearch';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { SignupSchema } from '@/types/auth-types';

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
      logger.warn('auth.signup.rate_limited', { requestId });
      return Api.tooManyRequests(
        'Too many signup attempts. Try again later.',
        (rateLimit.resetAt - Date.now()) / 1000,
      );
    }

    const body = await req.json().catch(() => null);
    const validation = SignupSchema.safeParse(body);

    if (!validation.success) {
      return Api.badRequest(
        'Invalid signup details',
        validation.error.format(),
      );
    }

    const { name, email, password } = validation.data;
    const { passwordHash } = hashPassword(password);

    // Public signup always creates an EMPLOYEE, never a self-elevated role,
    // and always attaches to the org provisioned out-of-band — see
    // AGENTS.md §6 and the problem statement's Screen 1 requirement.
    // TODO(auth): single-org lookup is a placeholder until invite-based org
    // assignment lands; flagged for whoever owns the signup flow.
    const org = await prisma.organization.findFirst({ select: { id: true } });
    if (!org) {
      return Api.serviceUnavailable('No organization is set up yet');
    }

    const user = await prisma.user.create({
      data: {
        orgId: org.id,
        name,
        email,
        role: 'EMPLOYEE',
        passwordHash,
      },
    });
    const session = await createSession(user.id, true);

    void upsertInSearch(usersEntityConfig, [user]);
    logger.info('auth.signup', { requestId, userId: user.id });

    const response = Api.created({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
    setSessionCookie(response, session.token, session.expiresAt);

    return response;
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return Api.conflict('An account with this email already exists');
    }

    logger.error('auth.signup.failed', error, { requestId });
    return Api.internalError('Failed to create account');
  }
}
