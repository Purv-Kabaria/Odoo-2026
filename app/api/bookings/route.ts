import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { dispatchNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { BookingCreateSchema } from "@/types/booking-types";

export async function GET() {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const bookings = await prisma.booking.findMany({
      where: { bookedById: user.id, status: { in: ["UPCOMING", "ONGOING"] } },
      orderBy: { startTime: "asc" },
      take: 50,
      include: { asset: { select: { id: true, assetTag: true, name: true } } },
    });

    return Api.ok(bookings);
  } catch (error) {
    logger.error("bookings.mine.failed", error, { requestId });
    return Api.internalError("Failed to load your bookings");
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const body = await req.json().catch(() => null);
    const validation = BookingCreateSchema.safeParse(body);
    if (!validation.success) return Api.badRequest("Invalid booking data", validation.error.format());
    const { assetId, title, startTime, endTime, onBehalfOfDeptId } = validation.data;

    const asset = await prisma.asset.findFirst({ where: { id: assetId, orgId: user.orgId } });
    if (!asset) return Api.notFound("Asset not found");
    if (!asset.isBookable) {
      return Api.badRequest("This asset is individually allocated, not a shared bookable resource");
    }

    const conflict = await prisma.booking.findFirst({
      where: {
        assetId,
        status: { not: "CANCELLED" },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    if (conflict) {
      const fmt = (d: Date) => d.toISOString().slice(11, 16);
      return Api.conflict(
        `Requested ${fmt(startTime)} to ${fmt(endTime)} UTC — conflict — slot is unavailable`,
        { code: "BOOKING_OVERLAP" },
      );
    }

    const booking = await prisma.booking.create({
      data: { assetId, bookedById: user.id, title: title ?? null, startTime, endTime, onBehalfOfDeptId: onBehalfOfDeptId ?? null },
    });

    void recordActivityEvent({
      orgId: user.orgId,
      action: "booking.confirmed",
      actorId: user.id,
      entityType: "booking",
      entityId: booking.id,
      metadata: { assetTag: asset.assetTag },
    });
    void dispatchNotification({
      recipientIds: [user.id],
      type: "BOOKING_CONFIRMED",
      title: `Booking confirmed: ${asset.assetTag} — ${asset.name}`,
      relatedEntityType: "booking",
      relatedEntityId: booking.id,
    });
    logger.info("bookings.create", { requestId, id: booking.id, assetId });

    return Api.created(booking);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23P01"
    ) {
      return Api.conflict("Requested slot overlaps an existing booking — slot is unavailable", { code: "BOOKING_OVERLAP" });
    }
    logger.error("bookings.create.failed", error, { requestId });
    return Api.internalError("Failed to create booking");
  }
}
