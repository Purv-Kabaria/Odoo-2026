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

/**
 * `User.passwordHash` is a single column (no separate salt/iterations
 * columns on the AssetFlow schema), so the per-user salt and iteration
 * count are self-encoded into the stored string, `pbkdf2$<iterations>$<saltHex>$<hashHex>`
 * — same pattern bcrypt/argon2 use natively. Keeps the per-user random
 * salt and a bump-able iteration count without needing extra columns.
 */
export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(
    password,
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST
  ).toString("hex");

  return {
    passwordHash: `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${hash}`,
  };
}

export function verifyPassword(password: string, user: { passwordHash: string }) {
  const parts = user.passwordHash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = Number(parts[1]);
  const salt = parts[2];
  const storedHash = Buffer.from(parts[3], "hex");
  if (!Number.isInteger(iterations) || iterations < 100_000) return false;

  const hash = pbkdf2Sync(password, salt, iterations, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST);

  return storedHash.length === hash.length && timingSafeEqual(storedHash, hash);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
