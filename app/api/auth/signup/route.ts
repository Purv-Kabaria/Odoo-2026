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
    const credential = hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role: 'USER',
        credential: {
          create: credential,
        },
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
