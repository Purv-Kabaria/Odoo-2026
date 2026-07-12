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
