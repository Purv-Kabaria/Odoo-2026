import { z } from "zod";

import { callChatCompletion, llmConfigured } from "@/lib/llm";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const RetirementRecommendationSchema = z.object({
  recommend_retirement: z.boolean(),
  reason: z.string().trim().min(1).max(500),
});

export type RetirementRecommendation = z.infer<typeof RetirementRecommendationSchema>;

export type RecommendationResult =
  | { success: true; data: RetirementRecommendation }
  | { success: false; reason: "not_configured" | "not_found" | "provider_error" | "invalid_response" };

const SYSTEM_PROMPT =
  'You are an asset-management assistant. Given an asset\'s acquisition cost, its maintenance history, and the issue that was just resolved, decide whether the asset should be recommended for retirement (e.g. repair frequency or cost now outweighs its remaining value). Respond with ONLY a JSON object matching exactly this shape, no prose, no markdown fences: {"recommend_retirement": boolean, "reason": string}. Keep "reason" under 400 characters and specific to the evidence given.';

function stripCodeFence(content: string): string {
  return content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
}

/**
 * Best-effort — never throws. Every caller (the fire-and-forget hook on
 * resolve, and the manual re-analyze endpoint) can `await`/`void` this
 * without a try/catch of its own; a down or unconfigured LLM degrades to a
 * `{success:false}` result, never an unhandled rejection.
 */
export async function evaluateRetirementRecommendation(
  maintenanceRequestId: string,
): Promise<RecommendationResult> {
  try {
    if (!llmConfigured()) {
      return { success: false, reason: "not_configured" };
    }

    const request_ = await prisma.maintenanceRequest.findUnique({
      where: { id: maintenanceRequestId },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            assetTag: true,
            acquisitionCost: true,
            acquisitionDate: true,
            condition: true,
            maintenanceRequests: {
              orderBy: { createdAt: "desc" },
              take: 20,
              select: { description: true, priority: true, status: true, createdAt: true, resolvedAt: true },
            },
          },
        },
      },
    });
    if (!request_) return { success: false, reason: "not_found" };

    const history = request_.asset.maintenanceRequests
      .map((m) => `- [${m.createdAt.toISOString().slice(0, 10)}] ${m.priority} priority, status ${m.status}: ${m.description}`)
      .join("\n");

    const userPrompt = [
      `Asset: ${request_.asset.name} (${request_.asset.assetTag})`,
      `Acquisition cost: ${request_.asset.acquisitionCost ? `$${request_.asset.acquisitionCost.toString()}` : "unknown"}`,
      `Acquisition date: ${request_.asset.acquisitionDate ? request_.asset.acquisitionDate.toISOString().slice(0, 10) : "unknown"}`,
      `Current condition: ${request_.asset.condition}`,
      `Most recently resolved issue: ${request_.description}`,
      `Maintenance history (most recent first, up to 20 requests):\n${history || "(no prior history)"}`,
    ].join("\n");

    const completion = await callChatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      maxTokens: 400,
    });

    if (!completion.success) {
      logger.warn("maintenance.retirement_recommendation.provider_failed", {
        maintenanceRequestId,
        status: completion.status,
      });
      return { success: false, reason: "provider_error" };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripCodeFence(completion.data.content));
    } catch {
      logger.warn("maintenance.retirement_recommendation.unparseable", { maintenanceRequestId });
      return { success: false, reason: "invalid_response" };
    }

    const validated = RetirementRecommendationSchema.safeParse(parsedJson);
    if (!validated.success) {
      logger.warn("maintenance.retirement_recommendation.invalid_shape", { maintenanceRequestId });
      return { success: false, reason: "invalid_response" };
    }

    await prisma.maintenanceRequest.update({
      where: { id: maintenanceRequestId },
      data: {
        aiRecommendRetirement: validated.data.recommend_retirement,
        aiRecommendReason: validated.data.reason,
        aiRecommendedAt: new Date(),
      },
    });

    return { success: true, data: validated.data };
  } catch (error) {
    logger.warn("maintenance.retirement_recommendation.unexpected_error", {
      maintenanceRequestId,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    return { success: false, reason: "invalid_response" };
  }
}
