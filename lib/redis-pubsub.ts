import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis-cache";

/**
 * Live notification fan-out across server instances.
 *
 * Every instance publishes to `notifications:user:<id>`. Each instance keeps ONE dedicated
 * subscriber connection (a subscribed Redis connection can't run other commands, so it can't be
 * the shared cache client) and multiplexes every open SSE stream onto it:
 *
 *   SSE stream ─┐
 *   SSE stream ─┼─ in-process listener map ── 1 subscriber connection ── Redis
 *   SSE stream ─┘
 *
 * A channel is SUBSCRIBEd when its first local listener appears and UNSUBSCRIBEd when its last
 * one leaves. The earlier design opened a new Redis connection per SSE stream, so Redis
 * connections grew with open browser tabs (two per tab when the bell and the notifications page
 * were both mounted). Now they grow with server instances.
 *
 * Pub/sub is fire-and-forget: a message published while nobody is subscribed is dropped.
 * That's acceptable because Postgres is the source of truth; the SSE route replays anything a
 * reconnecting client missed (see app/api/notifications/stream/route.ts).
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

type ChannelEntry = {
  listeners: Set<(message: string) => void>;
  ready: Promise<void>;
};

type Hub = {
  subscriber: RedisPubSubClient;
  channels: Map<string, ChannelEntry>;
};

declare global {
  var notificationHubPromise: Promise<Hub | null> | undefined;
}

function channelForUser(userId: string): string {
  return `notifications:user:${userId}`;
}

async function createHub(): Promise<Hub | null> {
  const base = (await getRedisClient()) as unknown as RedisPubSubClient | null;
  if (!base) return null;

  const subscriber = base.duplicate();
  subscriber.on("error", (error) => {
    logger.warn("notifications.subscriber_error", {
      errorMessage: error instanceof Error ? error.message : "Unknown Redis error",
    });
  });
  await subscriber.connect();
  return { subscriber, channels: new Map() };
}

/** One hub per server process; survives Next dev hot reload via globalThis. */
async function getHub(): Promise<Hub | null> {
  if (!globalThis.notificationHubPromise) {
    globalThis.notificationHubPromise = createHub();
  }
  try {
    const hub = await globalThis.notificationHubPromise;
    if (!hub) globalThis.notificationHubPromise = undefined; // Redis not configured yet: retry later
    return hub;
  } catch (error) {
    globalThis.notificationHubPromise = undefined;
    logger.warn("notifications.subscribe_failed", {
      errorMessage: error instanceof Error ? error.message : "Unknown Redis error",
    });
    return null;
  }
}

/** PUBLISH never needs a dedicated connection, so it uses the shared client. */
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
 * Registers a listener for one user's channel on this process's shared subscriber. Resolves
 * only once Redis has confirmed the SUBSCRIBE, so the caller can safely replay from Postgres
 * afterwards without a gap. Returns null when Redis is unavailable; the SSE route still opens
 * and the client still gets missed events through replay on its next reconnect.
 */
export async function createUserSubscription(
  userId: string,
  onMessage: (message: string) => void,
): Promise<UserSubscription | null> {
  const hub = await getHub();
  if (!hub) return null;

  const channel = channelForUser(userId);
  let entry = hub.channels.get(channel);
  if (!entry) {
    const listeners = new Set<(message: string) => void>();
    const ready = hub.subscriber
      .subscribe(channel, (message) => {
        for (const listener of hub.channels.get(channel)?.listeners ?? []) listener(message);
      })
      .catch((error: unknown) => {
        hub.channels.delete(channel);
        throw error;
      });
    entry = { listeners, ready };
    // Registered synchronously, before awaiting, so a concurrent caller for the same user joins
    // this entry instead of issuing a second SUBSCRIBE.
    hub.channels.set(channel, entry);
  }
  entry.listeners.add(onMessage);

  try {
    await entry.ready;
  } catch (error) {
    entry.listeners.delete(onMessage);
    logger.warn("notifications.subscribe_failed", {
      userId,
      errorMessage: error instanceof Error ? error.message : "Unknown Redis error",
    });
    return null;
  }

  const owned = entry;
  return {
    unsubscribe: async () => {
      owned.listeners.delete(onMessage);
      if (owned.listeners.size > 0 || hub.channels.get(channel) !== owned) return;
      hub.channels.delete(channel);
      try {
        await hub.subscriber.unsubscribe(channel);
      } catch {
        // Connection may be closing; nothing to clean up.
      }
    },
  };
}

/** For /api/health and tests: how many user channels this process is subscribed to. */
export async function activeNotificationChannels(): Promise<number> {
  const hub = globalThis.notificationHubPromise ? await globalThis.notificationHubPromise.catch(() => null) : null;
  return hub?.channels.size ?? 0;
}
