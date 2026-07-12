import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { BookingRescheduleSchema } from "@/types/booking-types";
import { z } from "zod";

const IdSchema = z.object({ id: z.string().cuid() });

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid booking id");

    const body = await req.json().catch(() => null);
    const validation = BookingRescheduleSchema.safeParse(body);
    if (!validation.success) return Api.badRequest("Invalid reschedule data", validation.error.format());
    const { startTime, endTime } = validation.data;

    const booking = await prisma.booking.findFirst({
      where: { id: idResult.data.id, asset: { orgId: user.orgId } },
    });
    if (!booking) return Api.notFound("Booking not found");
    if (booking.bookedById !== user.id) {
      return Api.forbidden("Only the original booker can reschedule this booking");
    }
    if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
      return Api.badRequest("This booking can no longer be rescheduled");
    }

    const conflict = await prisma.booking.findFirst({
      where: {
        assetId: booking.assetId,
        id: { not: booking.id },
        status: { not: "CANCELLED" },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    if (conflict) {
      return Api.conflict("Requested slot conflicts with an existing booking", { code: "BOOKING_OVERLAP" });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { startTime, endTime },
    });

    void recordActivityEvent({
      orgId: user.orgId,
      action: "booking.rescheduled",
      actorId: user.id,
      entityType: "booking",
      entityId: booking.id,
      metadata: {},
    });
    logger.info("bookings.reschedule", { requestId, id: booking.id });

    return Api.ok(updated);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23P01"
    ) {
      return Api.conflict("Requested slot overlaps an existing booking", { code: "BOOKING_OVERLAP" });
    }
    logger.error("bookings.reschedule.failed", error, { requestId });
    return Api.internalError("Failed to reschedule booking");
  }
}
