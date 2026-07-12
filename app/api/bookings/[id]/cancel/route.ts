import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { dispatchNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const IdSchema = z.object({ id: z.string().uuid() });

async function canCancel(
  user: { id: string; role: string; departmentId: string | null },
  booking: { bookedById: string; onBehalfOfDeptId: string | null },
): Promise<boolean> {
  if (user.id === booking.bookedById) return true;
  if (user.role === "ADMIN" || user.role === "ASSET_MANAGER") return true;
  if (user.role === "DEPARTMENT_HEAD" && booking.onBehalfOfDeptId) {
    const headed = await prisma.department.findFirst({ where: { id: booking.onBehalfOfDeptId, headId: user.id } });
    return Boolean(headed);
  }
  return false;
}

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid booking id");

    const booking = await prisma.booking.findFirst({
      where: { id: idResult.data.id, asset: { orgId: user.orgId } },
      include: { asset: { select: { assetTag: true } } },
    });
    if (!booking) return Api.notFound("Booking not found");
    if (booking.status === "CANCELLED") return Api.ok(booking);

    if (!(await canCancel(user, booking))) {
      return Api.forbidden("You can only cancel your own bookings");
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });

    void recordActivityEvent({
      orgId: user.orgId,
      action: "booking.cancelled",
      actorId: user.id,
      entityType: "booking",
      entityId: booking.id,
      metadata: {},
    });
    void dispatchNotification({
      recipientIds: [booking.bookedById],
      type: "BOOKING_CANCELLED",
      title: `Booking cancelled: ${booking.asset.assetTag}`,
      relatedEntityType: "booking",
      relatedEntityId: booking.id,
    });
    logger.info("bookings.cancel", { requestId, id: booking.id });

    return Api.ok(updated);
  } catch (error) {
    logger.error("bookings.cancel.failed", error, { requestId });
    return Api.internalError("Failed to cancel booking");
  }
}
