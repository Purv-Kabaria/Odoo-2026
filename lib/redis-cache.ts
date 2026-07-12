import { createClient } from "redis";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

type RedisCacheClient = {
  connect: () => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<boolean>;
  ttl: (key: string) => Promise<number>;
  set: (key: string, value: string, options: { EX: number }) => Promise<unknown>;
  del: (keys: string[]) => Promise<unknown>;
  ping: () => Promise<string>;
  scanIterator: (options: {
    MATCH: string;
    COUNT: number;
  }) => AsyncIterable<string | Buffer>;
  on: (event: "error", listener: (error: Error) => void) => RedisCacheClient;
};

declare global {
  var redisClientPromise: Promise<RedisCacheClient> | undefined;
}

function cacheEnabled(): boolean {
  return Boolean(env.REDIS_URL);
}

export async function getRedisClient(): Promise<RedisCacheClient | null> {
  if (!cacheEnabled()) return null;

  if (!globalThis.redisClientPromise) {
    globalThis.redisClientPromise = (async () => {
      const client = createClient({
        url: env.REDIS_URL,
      }) as unknown as RedisCacheClient;
      client.on("error", (error) => {
        logger.warn("cache.redis.error", {
          errorMessage: error instanceof Error ? error.message : "Unknown Redis error",
        });
      });
      await client.connect();
      return client;
    })();
  }

  try {
    return (await globalThis.redisClientPromise) ?? null;
  } catch (error) {
    globalThis.redisClientPromise = undefined;
    logger.warn("cache.redis.connect_failed", {
      errorMessage: error instanceof Error ? error.message : "Unknown Redis error",
    });
    return null;
  }
}

export async function getJsonCache<T>(key: string): Promise<T | null> {
  try {
    const client = await getRedisClient();
    if (!client) return null;

    const raw = await client.get(key);
    if (!raw) return null;

    return JSON.parse(raw) as T;
  } catch (error) {
    logger.warn("cache.redis.get_failed", {
      key,
      errorMessage: error instanceof Error ? error.message : "Unknown Redis error",
    });
    return null;
  }
}

export async function setJsonCache(
  key: string,
  value: unknown,
  ttlSeconds = env.CACHE_TTL_SECONDS,
): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;

    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    logger.warn("cache.redis.set_failed", {
      key,
      errorMessage: error instanceof Error ? error.message : "Unknown Redis error",
    });
  }
}

export async function deleteCacheByPrefix(prefix: string): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;

    const keys: string[] = [];
    for await (const key of client.scanIterator({
      MATCH: `${prefix}*`,
      COUNT: 100,
    })) {
      keys.push(String(key));
    }

    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    logger.warn("cache.redis.invalidate_failed", {
      prefix,
      errorMessage: error instanceof Error ? error.message : "Unknown Redis error",
    });
  }
}

export async function checkRedisCache(): Promise<"ok" | "not_configured" | "degraded"> {
  try {
    const client = await getRedisClient();
    if (!client) return "not_configured";
    const pong = await client.ping();
    return pong === "PONG" ? "ok" : "degraded";
  } catch {
    return "degraded";
  }
}
