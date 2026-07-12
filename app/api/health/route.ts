import { Api } from "@/lib/api";
import { env } from "@/lib/env";
import { llmConfigured } from "@/lib/llm";
import { checkObjectStorage } from "@/lib/object-storage";
import { prisma } from "@/lib/prisma";
import { checkRedisCache } from "@/lib/redis-cache";

async function checkUrl(url: string | undefined) {
  if (!url) return "not_configured";

  try {
    const response = await fetch(url, { cache: "no-store" });
    return response.ok ? "ok" : "degraded";
  } catch {
    return "degraded";
  }
}

export async function GET() {
  let database = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "degraded";
  }

  const [search, logging, cache, storage] = await Promise.all([
    checkUrl(env.MEILISEARCH_HOST ? `${env.MEILISEARCH_HOST}/health` : undefined),
    checkUrl(env.LOKI_PUSH_URL?.replace("/loki/api/v1/push", "/ready")),
    checkRedisCache(),
    checkObjectStorage(),
  ]);
  const llm = llmConfigured() ? "configured" : "not_configured";

  const status =
    database === "ok" &&
    search !== "degraded" &&
    logging !== "degraded" &&
    cache !== "degraded" &&
    storage !== "degraded"
      ? "ok"
      : "degraded";

  return Api.ok({
    status,
    services: {
      database,
      search,
      cache,
      storage,
      llm,
      logging,
    },
  });
}
