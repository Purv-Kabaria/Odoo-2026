import { getJsonCache, setJsonCache } from "@/lib/redis-cache";

const IDEMPOTENCY_TTL_SECONDS = 10 * 60;

export type ParsedIdempotencyKey =
  | { success: true; key: string | null }
  | { success: false; message: string };

export function parseIdempotencyKey(
  req: Request,
  userId: string,
  scope: string,
): ParsedIdempotencyKey {
  const raw = req.headers.get("idempotency-key");
  if (raw === null) return { success: true, key: null };

  const trimmed = raw.trim();
  if (trimmed.length < 8 || trimmed.length > 120) {
    return {
      success: false,
      message: "Idempotency-Key must be between 8 and 120 characters.",
    };
  }

  return { success: true, key: `idempotency:${scope}:${userId}:${trimmed}` };
}

export function idempotencyKeyFor(req: Request, userId: string, scope: string): string | null {
  const parsed = parseIdempotencyKey(req, userId, scope);
  return parsed.success ? parsed.key : null;
}

export async function getIdempotentResponse<T>(key: string | null): Promise<T | null> {
  if (!key) return null;
  return getJsonCache<T>(key);
}

export async function setIdempotentResponse(
  key: string | null,
  value: unknown,
): Promise<void> {
  if (!key) return;
  await setJsonCache(key, value, IDEMPOTENCY_TTL_SECONDS);
}
