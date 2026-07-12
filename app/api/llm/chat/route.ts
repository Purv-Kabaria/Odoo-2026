import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import {
  getIdempotentResponse,
  parseIdempotencyKey,
  setIdempotentResponse,
} from "@/lib/idempotency";
import { callChatCompletion, llmConfigured, LlmChatRequestSchema } from "@/lib/llm";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const LLM_RATE_LIMIT = 20;
const LLM_RATE_WINDOW_MS = 60 * 1000;

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const idempotency = parseIdempotencyKey(req, user.id, "llm-chat");
    if (!idempotency.success) return Api.badRequest(idempotency.message);
    const idempotencyKey = idempotency.key;
    const cached = await getIdempotentResponse<{
      content: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    }>(idempotencyKey);
    if (cached) return Api.ok(cached, { idempotent: true });

    if (!llmConfigured()) {
      return Api.badRequest("LLM provider is not configured");
    }

    const rateLimit = await checkRateLimit(
      `llm-chat:${getClientIp(req)}:${user.id}`,
      LLM_RATE_LIMIT,
      LLM_RATE_WINDOW_MS,
    );
    if (!rateLimit.success) {
      logger.warn("llm.chat.rate_limited", { requestId, userId: user.id });
      return Api.tooManyRequests(
        "Too many LLM requests. Try again shortly.",
        (rateLimit.resetAt - Date.now()) / 1000,
      );
    }

    const body = await req.json().catch(() => null);
    const validation = LlmChatRequestSchema.safeParse(body);
    if (!validation.success) {
      return Api.badRequest("Invalid LLM request", validation.error.format());
    }

    const startedAt = performance.now();
    const completion = await callChatCompletion(validation.data);
    if (!completion.success) {
      logger.warn("llm.chat.provider_failed", {
        requestId,
        userId: user.id,
        status: completion.status,
      });
      return completion.status === "not_configured"
        ? Api.serviceUnavailable(completion.message)
        : Api.internalError(completion.message);
    }

    logger.info("llm.chat", {
      requestId,
      userId: user.id,
      durationMs: Math.round(performance.now() - startedAt),
      totalTokens: completion.data.usage?.total_tokens ?? null,
    });

    void recordActivityEvent({
      action: "LLM_REQUESTED",
      actorId: user.id,
      entityType: "llm",
      summary: "LLM chat completion requested",
      requestId,
      metadata: {
        messageCount: validation.data.messages.length,
        maxTokens: validation.data.maxTokens,
        totalTokens: completion.data.usage?.total_tokens ?? null,
      },
    });

    void setIdempotentResponse(idempotencyKey, completion.data);
    return Api.ok(completion.data);
  } catch (error) {
    logger.error("llm.chat.failed", error, { requestId });
    return Api.internalError("LLM request failed");
  }
}
