import type { ActivityAction, Prisma, UserRole } from "@prisma/client";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export type ActivityEventView = {
  id: string;
  action: ActivityAction;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: Prisma.JsonValue | null;
  requestId: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
};

type RecordActivityEventInput = {
  action: ActivityAction;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
  requestId?: string;
};

const activitySelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  summary: true,
  metadata: true,
  requestId: true,
  createdAt: true,
  actor: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.ActivityEventSelect;

function toActivityEventView(
  event: Prisma.ActivityEventGetPayload<{ select: typeof activitySelect }>,
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
    await prisma.activityEvent.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        actorId: input.actorId ?? null,
        summary: input.summary,
        metadata: input.metadata,
        requestId: input.requestId,
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
  includeAll,
}: {
  limit: number;
  since?: Date;
  actorId: string;
  includeAll: boolean;
}): Promise<ActivityEventView[]> {
  const where: Prisma.ActivityEventWhereInput = {
    ...(includeAll ? {} : { actorId }),
    ...(since ? { createdAt: { gt: since } } : {}),
  };

  const events = await prisma.activityEvent.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: activitySelect,
  });

  return events.map(toActivityEventView);
}
