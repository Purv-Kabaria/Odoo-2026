import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis-cache";

/**
 * Separate from the `RedisCacheClient` type in `lib/redis-cache.ts`: once a
 * connection calls `.subscribe()` it can't run any other command, so the
 * subscriber needs its own dedicated connection (`.duplicate()`), not the
 * shared cache client. This type only exists to describe the extra surface
 * (`publish`/`duplicate`/`connect`/`subscribe`/`unsubscribe`/`quit`) pub/sub
 * needs — the underlying object is the same `redis` client instance either
 * way, so a single local cast at the boundary is enough.
 */
type PubSubListener = (message: string, channel: string) => void;

type RedisPubSubClient = {
  publish: (channel: string, message: string) => Promise<number>;
  duplicate: () => RedisPubSubClient;
  connect: () => Promise<unknown>;
  subscribe: (channel: string, listener: PubSubListener) => Promise<void>;
  unsubscribe: (channel?: string) => Promise<void>;
  quit: () => Promise<unknown>;
  on: (event: "error", listener: (error: Error) => void) => void;
};

function channelForUser(userId: string): string {
  return `notifications:user:${userId}`;
}

/** PUBLISH never needs a dedicated connection — safe on the shared client. */
export async function publishToUser(userId: string, payload: unknown): Promise<void> {
  try {
    const client = (await getRedisClient()) as unknown as RedisPubSubClient | null;
    if (!client) return;

    await client.publish(channelForUser(userId), JSON.stringify(payload));
  } catch (error) {
    logger.warn("notifications.publish_failed", {
      userId,
      errorMessage: error instanceof Error ? error.message : "Unknown Redis error",
    });
  }
}

export type UserSubscription = {
  unsubscribe: () => Promise<void>;
};

/**
 * Opens a dedicated subscriber connection for one SSE stream. Returns null
 * if Redis isn't configured/reachable — the caller (the SSE route) must
 * still open the stream and just skip live delivery, never fail the
 * request over an optional accelerator being down.
 */
export async function createUserSubscription(
  userId: string,
  onMessage: (message: string) => void,
): Promise<UserSubscription | null> {
  const base = (await getRedisClient()) as unknown as RedisPubSubClient | null;
  if (!base) return null;

  try {
    const subscriber = base.duplicate();
    subscriber.on("error", (error) => {
      logger.warn("notifications.subscriber_error", {
        userId,
        errorMessage: error instanceof Error ? error.message : "Unknown Redis error",
      });
    });
    await subscriber.connect();

    const channel = channelForUser(userId);
    await subscriber.subscribe(channel, (message) => onMessage(message));

    return {
      unsubscribe: async () => {
        try {
          await subscriber.unsubscribe(channel);
        } catch {
          // Connection may already be closed by the time cleanup runs.
        } finally {
          try {
            await subscriber.quit();
          } catch {
            // Already closed — nothing to do.
          }
        }
      },
    };
  } catch (error) {
    logger.warn("notifications.subscribe_failed", {
      userId,
      errorMessage: error instanceof Error ? error.message : "Unknown Redis error",
    });
    return null;
  }
}
