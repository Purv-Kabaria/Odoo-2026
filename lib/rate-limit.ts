import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis-cache";

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

type Bucket = {
  count: number;
  windowStartedAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 50_000;

function pruneIfNeeded() {
  if (buckets.size < MAX_TRACKED_KEYS) return;

  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartedAt > 60_000) {
      buckets.delete(key);
    }
  }
}

function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStartedAt >= windowMs) {
    pruneIfNeeded();
    buckets.set(key, { count: 1, windowStartedAt: now });
    return { success: true, limit, remaining: limit - 1, resetAt: now + windowMs };
  }

  const resetAt = existing.windowStartedAt + windowMs;
  if (existing.count >= limit) {
    return { success: false, limit, remaining: 0, resetAt };
  }

  existing.count += 1;
  return { success: true, limit, remaining: limit - existing.count, resetAt };
}

async function checkRedisRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const client = await getRedisClient();
  if (!client) return null;

  const redisKey = `rate-limit:${key}`;
  const windowSeconds = Math.ceil(windowMs / 1000);

  try {
    const count = await client.incr(redisKey);
    if (count === 1) {
      await client.expire(redisKey, windowSeconds);
    }

    const ttl = await client.ttl(redisKey);
    const resetAt = Date.now() + Math.max(1, ttl) * 1000;

    return {
      success: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  } catch (error) {
    logger.warn("rate_limit.redis_failed", {
      key,
      errorMessage: error instanceof Error ? error.message : "Unknown Redis error",
    });
    return null;
  }
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const redisResult = await checkRedisRateLimit(key, limit, windowMs);
  if (redisResult) return redisResult;
  return checkMemoryRateLimit(key, limit, windowMs);
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}
