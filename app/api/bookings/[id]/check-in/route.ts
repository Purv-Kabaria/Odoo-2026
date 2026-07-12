import { z } from "zod";

import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, assertOwnership } from "@/lib/rbac";

const IdSchema = z.object({ id: z.string().uuid() });

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
    });
    if (!booking) return Api.notFound("Booking not found");

    try {
      assertOwnership(user, booking.bookedById);
    } catch (error) {
      if (error instanceof ForbiddenError) return Api.forbidden("You can only check in to your own bookings");
      throw error;
    }

    if (booking.status === "CANCELLED" || booking.status === "COMPLETED" || booking.checkedIn) {
      return Api.conflict("Booking is not open for check-in", { code: "BOOKING_NOT_CHECKINABLE" });
    }

    const claimed = await prisma.booking.updateMany({
      where: { id: booking.id, checkedIn: false },
      data: { checkedIn: true, status: "ONGOING" },
    });
    if (claimed.count !== 1) {
      return Api.conflict("Check-in window has already closed for this booking");
    }

    const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });

    void recordActivityEvent({
      orgId: user.orgId,
      action: "booking.checked_in",
      actorId: user.id,
      entityType: "booking",
      entityId: booking.id,
      metadata: {},
    });
    logger.info("bookings.check_in", { requestId, id: booking.id });

    return Api.ok(updated);
  } catch (error) {
    logger.error("bookings.check_in.failed", error, { requestId });
    return Api.internalError("Failed to check in");
  }
}
