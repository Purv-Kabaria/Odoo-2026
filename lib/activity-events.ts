import type { Prisma, Role } from "@prisma/client";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export type ActivityEventView = {
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
  action: string;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  orgId: string;
  summary?: string;
  requestId?: string;
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

function toActivityEventView(
  event: Prisma.ActivityLogGetPayload<{ select: typeof activitySelect }>,
): ActivityEventView {
  return {
    ...event,
    createdAt: event.createdAt.toISOString(),
  };
}

export async function recordActivityEvent(
  input: RecordActivityEventInput,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        orgId: input.orgId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? "",
        actorId: input.actorId ?? null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    logger.warn("activity.record_failed", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      errorMessage: error instanceof Error ? error.message : "Unknown activity error",
    });
  }
}

export async function listActivityEvents({
  limit,
  since,
  actorId,
  orgId,
  includeAll,
}: {
  limit: number;
  since?: Date;
  actorId: string;
  orgId: string;
  includeAll: boolean;
}): Promise<ActivityEventView[]> {
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

  return events.map(toActivityEventView);
}
