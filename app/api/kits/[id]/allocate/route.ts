import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getIdempotentResponse, idempotencyKeyFor, setIdempotentResponse } from "@/lib/idempotency";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { deleteCacheByPrefix } from "@/lib/redis-cache";
import { AllocateKitSchema } from "@/types/kit-types";
import { z } from "zod";

// Prisma needs the Node TCP driver, not Edge. Kit size is capped at create
// time (types/kit-types.ts, 2-50 assets) so this handler always does a
// small, bounded number of round trips — one read for the kit + items, one
// batched conflict read, one transaction (N inserts + one batched update) —
// which keeps it well inside a serverless function's cold-start budget
// instead of scaling unbounded with kit size.
export const runtime = "nodejs";
export const maxDuration = 15;

const IdSchema = z.object({ id: z.string().uuid() });

function canAllocate(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER";
}

// Thrown when a per-asset insert loses the race against the partial-unique
// "one active allocation per asset" index between our pre-check read and
// the transaction actually committing — lets the catch block report the
// exact asset that lost the race instead of a generic 409.
class KitAllocationRaceError extends Error {
  constructor(
    public readonly assetId: string,
    public readonly assetTag: string,
  ) {
    super(`Asset ${assetTag} was allocated by another request just now`);
  }
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canAllocate(user.role)) return Api.forbidden("Only Asset Managers and Admins can allocate kits");

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid kit id");

    const idempotencyKey = idempotencyKeyFor(req, user.id, `kit-allocate:${idResult.data.id}`);
    const cached = await getIdempotentResponse(idempotencyKey);
    if (cached) return Api.ok(cached, { idempotent: true });

    const body = await req.json().catch(() => null);
    const validation = AllocateKitSchema.safeParse(body);
    if (!validation.success) return Api.badRequest("Invalid kit allocation data", validation.error.format());
    const { toEmployeeId, toDepartmentId, expectedReturnDate } = validation.data;

    const kit = await prisma.assetKit.findFirst({
      where: { id: idResult.data.id, orgId: user.orgId },
      select: {
        id: true,
        name: true,
        items: { select: { asset: { select: { id: true, assetTag: true, name: true, isBookable: true } } } },
      },
    });
    if (!kit) return Api.notFound("Kit not found");
    if (kit.items.length === 0) return Api.badRequest("This kit has no assets to allocate");

    const assets = kit.items.map((i) => i.asset);
    const assetIds = assets.map((a) => a.id);

    const bookable = assets.filter((a) => a.isBookable);
    if (bookable.length > 0) {
      return Api.badRequest(
        "This kit contains a shared bookable resource — remove it from the kit or use Resource Booking",
        { bookableAssets: bookable.map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name })) },
      );
    }

    // The conflict rule: if ANY asset in the kit is currently held, the
    // whole bulk allocation is blocked. One batched query, not a per-asset
    // loop, so this scales with kit size, not with a query per asset.
    const conflicts = await prisma.allocation.findMany({
      where: { assetId: { in: assetIds }, status: "ACTIVE" },
      select: {
        assetId: true,
        toEmployee: { select: { name: true } },
        toDepartment: { select: { name: true } },
      },
    });
    if (conflicts.length > 0) {
      const assetById = new Map(assets.map((a) => [a.id, a]));
      const details = conflicts.map((c) => {
        const asset = assetById.get(c.assetId);
        const holder = c.toEmployee?.name ?? c.toDepartment?.name ?? "another holder";
        return { assetId: c.assetId, assetTag: asset?.assetTag ?? c.assetId, name: asset?.name ?? "", holder };
      });
      const summary = details.map((d) => `${d.assetTag} (held by ${d.holder})`).join(", ");
      return Api.conflict(`Blocked — already allocated: ${summary}`, {
        code: "KIT_ASSET_ALREADY_ALLOCATED",
        conflicts: details,
      });
    }

    const { kitAllocation, allocations } = await prisma.$transaction(async (tx) => {
      const kitAllocationRow = await tx.kitAllocation.create({
        data: {
          kitId: kit.id,
          toEmployeeId,
          toDepartmentId,
          allocatedById: user.id,
          expectedReturnDate: expectedReturnDate ?? null,
        },
      });

      const createdAllocations = [];
      for (const asset of assets) {
        try {
          const created = await tx.allocation.create({
            data: {
              assetId: asset.id,
              toEmployeeId,
              toDepartmentId,
              allocatedById: user.id,
              expectedReturnDate: expectedReturnDate ?? null,
              kitAllocationId: kitAllocationRow.id,
            },
          });
          createdAllocations.push(created);
        } catch (error: unknown) {
          if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
            throw new KitAllocationRaceError(asset.id, asset.assetTag);
          }
          throw error;
        }
      }

      await tx.asset.updateMany({ where: { id: { in: assetIds } }, data: { status: "ALLOCATED" } });

      return { kitAllocation: kitAllocationRow, allocations: createdAllocations };
    });

    void deleteCacheByPrefix(`assets:list:${user.orgId}:`);
    void recordActivityEvent({
      orgId: user.orgId,
      action: "kit.allocated",
      actorId: user.id,
      entityType: "kit_allocation",
      entityId: kitAllocation.id,
      metadata: { kitId: kit.id, kitName: kit.name, assetCount: assets.length, toEmployeeId, toDepartmentId },
    });
    // Every individual asset gets the same per-asset history event a
    // single-asset allocation would produce, so its trail on the asset
    // detail page looks identical regardless of how it was allocated.
    for (const asset of assets) {
      void recordActivityEvent({
        orgId: user.orgId,
        action: "asset.allocated",
        actorId: user.id,
        entityType: "allocation",
        entityId: allocations.find((a) => a.assetId === asset.id)?.id ?? asset.id,
        metadata: { assetTag: asset.assetTag, toEmployeeId, toDepartmentId, viaKitId: kit.id },
      });
    }

    const payload = { kitAllocation, allocations };
    void setIdempotentResponse(idempotencyKey, payload);
    logger.info("kits.allocate", {
      requestId,
      kitId: kit.id,
      kitAllocationId: kitAllocation.id,
      assetCount: assets.length,
      durationMs: Math.round(performance.now() - startedAt),
    });

    return Api.created(payload);
  } catch (error: unknown) {
    if (error instanceof KitAllocationRaceError) {
      return Api.conflict(`Blocked — ${error.assetTag} was just allocated by another request`, {
        code: "KIT_ASSET_ALREADY_ALLOCATED",
        conflicts: [{ assetId: error.assetId, assetTag: error.assetTag }],
      });
    }
    logger.error("kits.allocate.failed", error, { requestId });
    return Api.internalError("Failed to allocate kit");
  }
}
