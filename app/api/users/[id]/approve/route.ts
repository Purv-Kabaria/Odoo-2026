import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function PATCH(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();

  try {
    const actor = await getCurrentUser();
    if (!actor) return Api.unauthorized();

    // Check permissions
    try {
      requireRole(actor, "ADMIN");
    } catch {
      return Api.forbidden("Only administrators can approve users");
    }

    const { id } = await props.params;

    // Fetch the target user and verify tenant boundary
    const targetUser = await prisma.user.findFirst({
      where: { id, orgId: actor.orgId },
    });

    if (!targetUser) {
      return Api.notFound("User not found");
    }

    if (targetUser.status !== "PENDING_APPROVAL") {
      return Api.badRequest(`User is not pending approval. Current status: ${targetUser.status}`);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update status
      const updated = await tx.user.update({
        where: { id: targetUser.id },
        data: {
          status: "ACTIVE",
          approvedById: actor.id,
          approvedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          approvedById: true,
          approvedAt: true,
        },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          orgId: actor.orgId,
          actorId: actor.id,
          action: "USER_APPROVED",
          entityType: "User",
          entityId: targetUser.id,
          metadata: {
            approvedEmail: targetUser.email,
          },
        },
      });

      return updated;
    });

    logger.info("users.approved", {
      requestId,
      actorId: actor.id,
      approvedUserId: targetUser.id,
    });

    return Api.ok({
      message: "User approved successfully",
      user: result,
    });
  } catch (error) {
    logger.error("users.approve.failed", error, { requestId });
    return Api.internalError("Failed to approve user");
  }
}
