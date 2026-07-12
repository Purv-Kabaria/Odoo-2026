import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { assetSearchConfig } from "@/lib/entities/assets";
import { logger } from "@/lib/logger";
import { upsertInSearch } from "@/lib/meilisearch";
import { prisma } from "@/lib/prisma";
import { deleteCacheByPrefix } from "@/lib/redis-cache";
import { AssetUpdateSchema } from "@/types/asset-types";
import { z } from "zod";

const IdSchema = z.object({ id: z.string().uuid("Invalid asset id") });

function canManageAssets(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER";
}

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid asset id");

    const asset = await prisma.asset.findFirst({
      where: { id: idResult.data.id, orgId: user.orgId },
      include: {
        category: { select: { id: true, name: true, fieldSchema: true } },
        allocations: {
          orderBy: { allocatedAt: "desc" },
          take: 10,
          include: {
            toEmployee: { select: { id: true, name: true } },
            toDepartment: { select: { id: true, name: true } },
            allocatedBy: { select: { id: true, name: true } },
          },
        },
        maintenanceRequests: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { technician: { select: { id: true, name: true } } },
        },
      },
    });
    if (!asset) return Api.notFound("Asset not found");

    return Api.ok(asset);
  } catch (error) {
    logger.error("assets.get.failed", error, { requestId });
    return Api.internalError("Failed to load asset");
  }
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canManageAssets(user.role)) {
      return Api.forbidden("Only Asset Managers and Admins can update assets");
    }

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid asset id");

    const body = await req.json().catch(() => null);
    const validation = AssetUpdateSchema.safeParse(body);
    if (!validation.success) {
      return Api.badRequest("Invalid asset data", validation.error.format());
    }

    const existing = await prisma.asset.findFirst({
      where: { id: idResult.data.id, orgId: user.orgId },
    });
    if (!existing) return Api.notFound("Asset not found");

    if (
      validation.data.status &&
      !["AVAILABLE", "RETIRED", "DISPOSED"].includes(existing.status)
    ) {
      return Api.badRequest(
        `Cannot manually change status while the asset is ${existing.status.toLowerCase().replace("_", " ")} — that's driven by its allocation, booking, or maintenance state.`,
      );
    }

    const { customFields, ...rest } = validation.data;
    const updated = await prisma.asset.update({
      where: { id: idResult.data.id },
      data: {
        ...rest,
        ...(customFields ? { customFields } : {}),
      },
    });

    void upsertInSearch(assetSearchConfig, [updated]);
    void deleteCacheByPrefix(`assets:list:${user.orgId}:`);
    void recordActivityEvent({
      orgId: user.orgId,
      action: "asset.updated",
      actorId: user.id,
      entityType: "asset",
      entityId: updated.id,
      metadata: { assetTag: updated.assetTag },
    });
    logger.info("assets.update", { requestId, id: updated.id });

    return Api.ok(updated);
  } catch (error) {
    logger.error("assets.update.failed", error, { requestId });
    return Api.internalError("Failed to update asset");
  }
}
