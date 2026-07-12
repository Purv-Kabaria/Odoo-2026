import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

/**
 * Pure, dependency-free password/token hashing. Deliberately has zero
 * imports beyond Node's `crypto` so it can be unit-tested in isolation and
 * imported anywhere (scripts, tests, route handlers) without pulling in
 * Next.js request context or Prisma.
 *
 * Passwords are stored as a single composite string:
 *   pbkdf2:<iterations>:<salt_hex>:<hash_hex>
 * This keeps the User model simple (one `passwordHash` column) while
 * preserving all parameters needed for verification.
 */

const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = "sha256";

/**
 * Hash a plaintext password into a composite string.
 * Format: `pbkdf2:<iterations>:<salt_hex>:<hash_hex>`
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(
    password,
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST,
  ).toString("hex");

  return `pbkdf2:${PASSWORD_ITERATIONS}:${salt}:${hash}`;
}

/**
 * Verify a plaintext password against a stored composite hash.
 * Timing-safe comparison prevents timing attacks.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") {
    return false;
  }

  const iterations = parseInt(parts[1], 10);
  const salt = parts[2];
  const expectedHash = parts[3];

  if (!iterations || iterations < 100_000 || !salt || !expectedHash) {
    return false;
  }

  const hash = pbkdf2Sync(
    password,
    salt,
    iterations,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST,
  );

  const storedBuffer = Buffer.from(expectedHash, "hex");
  return storedBuffer.length === hash.length && timingSafeEqual(storedBuffer, hash);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
