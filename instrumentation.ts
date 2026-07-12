/**
 * Next.js calls `register()` once per server process on startup (App
 * Router, on by default since Next 15 — no experimental flag needed).
 * This is where the CRON sweeps get bootstrapped: no separate worker
 * deployment, just code that runs alongside the app server.
 *
 * `globalThis.__cronRegistered` guards against Next's dev-mode hot-reload
 * re-invoking `register()` and scheduling every job twice — same
 * `globalThis` singleton pattern `lib/redis-cache.ts` already uses for its
 * client.
 */
declare global {
  var __cronRegistered: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (globalThis.__cronRegistered) return;
  globalThis.__cronRegistered = true;

  const { registerCronJobs } = await import("@/lib/cron");
  registerCronJobs();
}
