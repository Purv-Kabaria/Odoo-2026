import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { listNotificationsAfter, type NotificationView } from '@/lib/notifications';
import { createUserSubscription } from '@/lib/redis-pubsub';
import { NotificationStreamResumeSchema } from '@/types/notification-types';

// Never statically evaluated/cached — every connection is a live per-user stream.
export const dynamic = 'force-dynamic';

const HEARTBEAT_INTERVAL_MS = 25000;
const REPLAY_LIMIT = 100;
const SEEN_ID_CAP = 500;

/**
 * Live notifications over SSE, with no gaps across disconnects.
 *
 * Postgres is the source of truth; Redis pub/sub is only the fast path. Every event carries
 * `id: <notification id>`. When an EventSource reconnects, the browser sends the last id it got
 * as `Last-Event-ID`, and the server replays everything newer from Postgres.
 *
 * Order matters on connect:
 *   1. SUBSCRIBE first, buffering live messages.
 *   2. Then read missed rows from Postgres and send them.
 *   3. Then flush the buffer, skipping ids already sent.
 * Reading Postgres first would leave a window where a notification committed after the read but
 * before the subscription is in neither the replay nor the live feed. Subscribing first makes the
 * two overlap instead, and the id check removes the duplicates.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const rawResume = req.headers.get('last-event-id') ?? new URL(req.url).searchParams.get('since');
  const resume = rawResume ? NotificationStreamResumeSchema.safeParse(rawResume) : null;
  const resumeAfter = resume?.success ? resume.data : null;

  const encoder = new TextEncoder();
  let subscription: Awaited<ReturnType<typeof createUserSubscription>> = null;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    void subscription?.unsubscribe();
  };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Controller already closed by a concurrent cleanup — ignore.
        }
      };

      const seen = new Set<string>();
      const deliver = (notification: Pick<NotificationView, 'id'>, raw: string) => {
        if (seen.has(notification.id)) return;
        seen.add(notification.id);
        if (seen.size > SEEN_ID_CAP) {
          const oldest = seen.values().next().value;
          if (oldest !== undefined) seen.delete(oldest);
        }
        send(`id: ${notification.id}\ndata: ${raw}\n\n`);
      };

      let replaying = true;
      const buffered: string[] = [];
      const onLive = (raw: string) => {
        if (replaying) {
          buffered.push(raw);
          return;
        }
        try {
          deliver(JSON.parse(raw) as NotificationView, raw);
        } catch {
          // Malformed publish payload; Postgres still has the row.
        }
      };

      req.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });

      send(`retry: 3000\n\n`);
      heartbeat = setInterval(() => send(`:heartbeat\n\n`), HEARTBEAT_INTERVAL_MS);

      subscription = await createUserSubscription(user.id, onLive);
      if (!subscription) {
        logger.warn('notifications.stream.no_redis', { userId: user.id });
      }
      if (closed) {
        void subscription?.unsubscribe();
        return;
      }

      if (resumeAfter) {
        try {
          const missed = await listNotificationsAfter(user.id, resumeAfter, REPLAY_LIMIT);
          for (const row of missed) deliver(row, JSON.stringify(row));
          if (missed.length > 0) {
            logger.info('notifications.stream.replayed', { userId: user.id, count: missed.length });
          }
        } catch (error) {
          logger.warn('notifications.stream.replay_failed', {
            userId: user.id,
            errorMessage: error instanceof Error ? error.message : 'Unknown replay error',
          });
        }
      }

      replaying = false;
      for (const raw of buffered.splice(0)) onLive(raw);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
