import type { Prisma, Role } from "@prisma/client";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export type ActivityLogView = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: Role;
  } | null;
};

type RecordActivityEventInput = {
  orgId: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

const activitySelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  metadata: true,
  createdAt: true,
  actor: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.ActivityLogSelect;

function toActivityLogView(
  event: Prisma.ActivityLogGetPayload<{ select: typeof activitySelect }>,
): ActivityLogView {
  return {
    ...event,
    createdAt: event.createdAt.toISOString(),
  };
}

/**
 * `action` is a free-text string (`"asset.allocated"` style) rather than a
 * fixed enum — the AssetFlow schema's `ActivityLog.action` column is a
 * plain string, so new action vocabulary never needs a migration.
 */
export async function recordActivityEvent(
  input: RecordActivityEventInput,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        orgId: input.orgId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        actorId: input.actorId ?? null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    logger.warn("activity.record_failed", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      errorMessage: error instanceof Error ? error.message : "Unknown activity error",
    });
  }
}

export async function listActivityEvents({
  limit,
  since,
  orgId,
  actorId,
  includeAll,
}: {
  limit: number;
  since?: Date;
  orgId: string;
  actorId: string;
  includeAll: boolean;
}): Promise<ActivityLogView[]> {
  const where: Prisma.ActivityLogWhereInput = {
    orgId,
    ...(includeAll ? {} : { actorId }),
    ...(since ? { createdAt: { gt: since } } : {}),
  };

  const events = await prisma.activityLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: activitySelect,
  });

  return events.map(toActivityLogView);
}
