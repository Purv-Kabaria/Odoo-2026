import { z } from "zod";

import { env } from "@/lib/env";
import { resilientFetch } from "@/lib/resilience";

export const LlmMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().trim().min(1).max(8000),
});

export const LlmChatRequestSchema = z.object({
  messages: z.array(LlmMessageSchema).min(1).max(20),
  temperature: z.number().min(0).max(2).default(0.2),
  maxTokens: z.number().int().min(1).max(2000).default(700),
});

type LlmChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export type LlmCompletionResult =
  | {
      success: true;
      data: {
        content: string;
        usage?: LlmChatResponse["usage"];
      };
    }
  | {
      success: false;
      status: "not_configured" | "unavailable" | "provider_error" | "invalid_response";
      message: string;
    };

export function llmConfigured(): boolean {
  return Boolean(env.LLM_API_BASE_URL && env.LLM_API_KEY);
}

export async function callChatCompletion(
  input: z.infer<typeof LlmChatRequestSchema>,
): Promise<LlmCompletionResult> {
  if (!llmConfigured()) {
    return {
      success: false,
      status: "not_configured",
      message: "LLM provider is not configured.",
    };
  }

  const baseUrl = env.LLM_API_BASE_URL?.replace(/\/$/, "");
  const response = await resilientFetch(
    `${baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        messages: input.messages,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
      }),
      cache: "no-store",
    },
    {
      name: "llm",
      timeoutMs: env.LLM_TIMEOUT_MS,
      retries: 1,
      retryDelayMs: 250,
      failureThreshold: 3,
      circuitOpenMs: 30000,
    },
  );

  if (!response) {
    return {
      success: false,
      status: "unavailable",
      message: "The LLM provider is temporarily unavailable. Please try again shortly.",
    };
  }

  if (!response.ok) {
    return {
      success: false,
      status: "provider_error",
      message:
        response.status === 401 || response.status === 403
          ? "The LLM provider rejected the configured credentials."
          : "The LLM provider could not complete the request.",
    };
  }

  const json = (await response.json().catch(() => null)) as LlmChatResponse | null;
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    return {
      success: false,
      status: "invalid_response",
      message: "The LLM provider returned an empty response.",
    };
  }

  return { success: true, data: { content, usage: json?.usage } };
}
