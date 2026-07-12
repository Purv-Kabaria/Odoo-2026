import { Api } from "@/lib/api";
import { env } from "@/lib/env";
import { llmConfigured } from "@/lib/llm";
import { logger } from "@/lib/logger";
import { checkObjectStorage } from "@/lib/object-storage";
import { prisma } from "@/lib/prisma";
import { checkRedisCache } from "@/lib/redis-cache";

const HEALTH_CHECK_TIMEOUT_MS = 3000;

async function checkUrl(name: string, url: string | undefined) {
  if (!url) return "not_configured";

  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS) });
    if (!response.ok) {
      logger.warn("health.check_degraded", { dependency: name, status: response.status });
    }
    return response.ok ? "ok" : "degraded";
  } catch (error) {
    logger.warn("health.check_failed", {
      dependency: name,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    return "degraded";
  }
}

export async function GET() {
  let database = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    database = "degraded";
    logger.warn("health.check_failed", {
      dependency: "database",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  const [search, logging, cache, storage] = await Promise.all([
    checkUrl("meilisearch", env.MEILISEARCH_HOST ? `${env.MEILISEARCH_HOST}/health` : undefined),
    checkUrl("loki", env.LOKI_PUSH_URL?.replace("/loki/api/v1/push", "/ready")),
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
