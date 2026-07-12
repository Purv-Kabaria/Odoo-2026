import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

/**
 * Pure, dependency-free password/token hashing. Deliberately has zero
 * imports beyond Node's `crypto` so it can be unit-tested in isolation and
 * imported anywhere (scripts, tests, route handlers) without pulling in
 * Next.js request context or Prisma.
 */

const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = "sha256";

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(
    password,
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST
  ).toString("hex");

  return {
    passwordHash: hash,
    salt,
    iterations: PASSWORD_ITERATIONS,
  };
}

export function verifyPassword(
  password: string,
  credential: { passwordHash: string; salt: string; iterations: number }
) {
  const hash = pbkdf2Sync(
    password,
    credential.salt,
    credential.iterations,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST
  );
  const storedHash = Buffer.from(credential.passwordHash, "hex");

  return storedHash.length === hash.length && timingSafeEqual(storedHash, hash);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
