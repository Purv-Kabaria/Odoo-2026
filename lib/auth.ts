import { randomBytes } from 'crypto';

import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { hashToken } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie';

const SESSION_DAYS = 30;

export { hashPassword, hashToken, verifyPassword } from '@/lib/password';

export async function createSession(userId: string, rememberMe: boolean) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(
    Date.now() + (rememberMe ? SESSION_DAYS : 1) * 24 * 60 * 60 * 1000,
  );

  await prisma.authSession.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  // This is called on every page render (root layout needs it for the
  // navbar), so a transient database outage must degrade to "signed out"
  // rather than 500 the entire site, including public marketing pages.
  // Protected routes stay safe either way: `(protected)/layout.tsx` treats
  // a null user as unauthenticated and redirects to /login.
  let session;
  try {
    session = await prisma.authSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        user: {
          select: {
            id: true,
            orgId: true,
            name: true,
            email: true,
            role: true,
            status: true,
            departmentId: true,
          },
        },
      },
    });
  } catch (error) {
    logger.error('auth.session_lookup_failed', error);
    return null;
  }

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      void prisma.authSession.deleteMany({
        where: { tokenHash: hashToken(token) },
      });
    }
    return null;
  }

  // A user deactivated mid-session must lose access immediately, not once
  // their existing session token happens to expire (up to 30 days later).
  if (session.user.status !== 'ACTIVE') {
    void prisma.authSession.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
    return null;
  }

  return session.user;
}
