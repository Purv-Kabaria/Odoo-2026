import { z } from "zod";

import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { deriveCheckInStatus } from "@/lib/bookings";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requireRole } from "@/lib/rbac";
import { BookingCreateSchema } from "@/types/booking-types";

const BookingListQuerySchema = z.object({
  scope: z.enum(["org"]).optional(),
});

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const query = BookingListQuerySchema.safeParse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    if (!query.success) return Api.badRequest("Invalid query parameters", query.error.format());

    if (query.data.scope === "org") {
      try {
        requireRole(user, "ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD");
      } catch (error) {
        if (error instanceof ForbiddenError) return Api.forbidden(error.message);
        throw error;
      }

      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const bookings = await prisma.booking.findMany({
        where: {
          asset: { orgId: user.orgId },
          startTime: { gte: startOfDay, lt: endOfDay },
          ...(user.role === "DEPARTMENT_HEAD" ? { onBehalfOfDeptId: user.departmentId } : {}),
        },
        orderBy: { startTime: "asc" },
        take: 200,
        include: {
          asset: { select: { id: true, assetTag: true, name: true } },
          bookedBy: { select: { name: true } },
        },
      });

      return Api.ok(bookings.map((b) => ({ ...b, checkInStatus: deriveCheckInStatus(b) })));
    }

    const bookings = await prisma.booking.findMany({
      where: { bookedById: user.id, status: { in: ["UPCOMING", "ONGOING"] } },
      orderBy: { startTime: "asc" },
      take: 50,
      include: { asset: { select: { id: true, assetTag: true, name: true } } },
    });

    return Api.ok(bookings.map((b) => ({ ...b, checkInStatus: deriveCheckInStatus(b) })));
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

    const checkInDeadline = new Date(startTime.getTime() + 15 * 60 * 1000);
    const booking = await prisma.booking.create({
      data: {
        assetId,
        bookedById: user.id,
        title: title ?? null,
        startTime,
        endTime,
        onBehalfOfDeptId: onBehalfOfDeptId ?? null,
        checkInDeadline,
      },
    });

    void recordActivityEvent({
      orgId: user.orgId,
      action: "booking.confirmed",
      actorId: user.id,
      entityType: "booking",
      entityId: booking.id,
      metadata: { assetTag: asset.assetTag },
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
