import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { createUserSubscription } from '@/lib/redis-pubsub';

// Never statically evaluated/cached — every connection is a live per-user stream.
export const dynamic = 'force-dynamic';

const HEARTBEAT_INTERVAL_MS = 25000;

/**
 * SSE endpoint: one dedicated Redis subscriber connection per open stream
 * (see lib/redis-pubsub.ts — a subscribed connection can't run other
 * commands, so it's never the shared cache client). If Redis isn't
 * configured the stream still opens and just heartbeats — the notification
 * list still works from Postgres, real-time delivery simply degrades to
 * none, same "optional accelerator, never a hard dependency" rule as
 * search/cache elsewhere in this app.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  let subscription: Awaited<ReturnType<typeof createUserSubscription>> = null;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Controller already closed by a concurrent cleanup — ignore.
        }
      };

      send(`retry: 3000\n\n`);
      heartbeat = setInterval(() => send(`:heartbeat\n\n`), HEARTBEAT_INTERVAL_MS);

      subscription = await createUserSubscription(user.id, (message) => {
        send(`data: ${message}\n\n`);
      });

      if (!subscription) {
        logger.warn('notifications.stream.no_redis', { userId: user.id });
      }

      req.signal.addEventListener('abort', () => {
        if (heartbeat) clearInterval(heartbeat);
        void subscription?.unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      void subscription?.unsubscribe();
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
