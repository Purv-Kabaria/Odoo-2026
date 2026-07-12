import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { ChangeStatusSchema } from "@/types/auth-types";

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();

  try {
    const actor = await getCurrentUser();
    if (!actor) return Api.unauthorized();

    try {
      requireRole(actor, "ADMIN");
    } catch {
      return Api.forbidden("Only administrators can update user status");
    }

    const { id } = await props.params;

    // Prevent self-deactivation
    if (id === actor.id) {
      return Api.badRequest("You cannot deactivate or update your own status");
    }

    // Fetch the target user and verify tenant boundary
    const targetUser = await prisma.user.findFirst({
      where: { id, orgId: actor.orgId },
    });

    if (!targetUser) {
      return Api.notFound("User not found");
    }

    const body = await req.json().catch(() => null);
    const validation = ChangeStatusSchema.safeParse(body);

    if (!validation.success) {
      return Api.badRequest("Invalid status", validation.error.format());
    }

    const { status: targetStatus } = validation.data;

    if (targetUser.status === targetStatus) {
      return Api.badRequest(`User status is already ${targetStatus}`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUser.id },
        data: { status: targetStatus },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
        },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          orgId: actor.orgId,
          actorId: actor.id,
          action: "USER_STATUS_CHANGED",
          entityType: "User",
          entityId: targetUser.id,
          metadata: {
            targetEmail: targetUser.email,
            oldStatus: targetUser.status,
            newStatus: targetStatus,
          },
        },
      });

      return updated;
    });

    logger.info("users.status_changed", {
      requestId,
      actorId: actor.id,
      targetUserId: targetUser.id,
      oldStatus: targetUser.status,
      newStatus: targetStatus,
    });

    return Api.ok({
      message: `User status updated to ${targetStatus} successfully`,
      user: result,
    });
  } catch (error) {
    logger.error("users.status.failed", error, { requestId });
    return Api.internalError("Failed to update user status");
  }
}
