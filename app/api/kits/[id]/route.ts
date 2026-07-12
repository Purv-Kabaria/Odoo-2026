import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { deleteCacheByPrefix } from "@/lib/redis-cache";
import { z } from "zod";

export const runtime = "nodejs";

const IdSchema = z.object({ id: z.string().uuid() });

function canAllocate(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER";
}

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid kit id");

    const kit = await prisma.assetKit.findFirst({
      where: { id: idResult.data.id, orgId: user.orgId },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
        items: {
          select: {
            asset: {
              select: { id: true, assetTag: true, name: true, status: true, isBookable: true },
            },
          },
        },
      },
    });
    if (!kit) return Api.notFound("Kit not found");

    return Api.ok({ ...kit, items: kit.items.map((i) => i.asset) });
  } catch (error) {
    logger.error("kits.get.failed", error, { requestId });
    return Api.internalError("Failed to load kit");
  }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canAllocate(user.role)) return Api.forbidden("Only Asset Managers and Admins can delete kits");

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid kit id");

    const kit = await prisma.assetKit.findFirst({ where: { id: idResult.data.id, orgId: user.orgId } });
    if (!kit) return Api.noContent(); // idempotent delete — already gone is success

    await prisma.assetKit.delete({ where: { id: kit.id } });

    void deleteCacheByPrefix(`kits:list:${user.orgId}:`);
    void recordActivityEvent({
      orgId: user.orgId,
      action: "kit.deleted",
      actorId: user.id,
      entityType: "asset_kit",
      entityId: kit.id,
      metadata: { name: kit.name },
    });
    logger.info("kits.delete", { requestId, id: kit.id });

    return Api.noContent();
  } catch (error: unknown) {
    const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: string }).code : undefined;
    if (code === "P2003") {
      return Api.conflict("This kit has allocation history and cannot be deleted", { code: "KIT_HAS_HISTORY" });
    }
    // A concurrent delete can win the race between the findFirst check above
    // and this delete — Prisma reports that as P2025 ("record not found").
    // Matches this repo's idempotent-delete contract: already gone is a
    // no-op success, not a 500.
    if (code === "P2025") {
      return Api.noContent();
    }
    logger.error("kits.delete.failed", error, { requestId });
    return Api.internalError("Failed to delete kit");
  }
}
