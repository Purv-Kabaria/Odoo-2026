import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { ChangeRoleSchema } from "@/types/auth-types";

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
      return Api.forbidden("Only administrators can change user roles");
    }

    const { id } = await props.params;

    // Prevent self-demotion, which could leave an org with zero admins
    if (id === actor.id) {
      return Api.badRequest("You cannot change your own role");
    }

    // Fetch the target user and verify tenant boundary
    const targetUser = await prisma.user.findFirst({
      where: { id, orgId: actor.orgId },
    });

    if (!targetUser) {
      return Api.notFound("User not found");
    }

    const body = await req.json().catch(() => null);
    const validation = ChangeRoleSchema.safeParse(body);

    if (!validation.success) {
      return Api.badRequest("Invalid role", validation.error.format());
    }

    const { role: targetRole } = validation.data;

    if (targetUser.role === targetRole) {
      return Api.badRequest(`User already has the role ${targetRole}`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUser.id },
        data: { role: targetRole },
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
          action: "USER_ROLE_CHANGED",
          entityType: "User",
          entityId: targetUser.id,
          metadata: {
            targetEmail: targetUser.email,
            oldRole: targetUser.role,
            newRole: targetRole,
          },
        },
      });

      return updated;
    });

    logger.info("users.role_changed", {
      requestId,
      actorId: actor.id,
      targetUserId: targetUser.id,
      oldRole: targetUser.role,
      newRole: targetRole,
    });

    return Api.ok({
      message: "User role updated successfully",
      user: result,
    });
  } catch (error) {
    logger.error("users.role.failed", error, { requestId });
    return Api.internalError("Failed to update user role");
  }
}
