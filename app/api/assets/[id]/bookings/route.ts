import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { BookingWindowQuerySchema } from "@/types/booking-types";
import { z } from "zod";

const IdSchema = z.object({ id: z.string().uuid() });

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid asset id");

    const searchParams = new URL(req.url).searchParams;
    const validation = BookingWindowQuerySchema.safeParse({
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });
    if (!validation.success) return Api.badRequest("Provide a valid from/to window", validation.error.format());

    const asset = await prisma.asset.findFirst({ where: { id: idResult.data.id, orgId: user.orgId } });
    if (!asset) return Api.notFound("Asset not found");

    const bookings = await prisma.booking.findMany({
      where: {
        assetId: asset.id,
        status: { not: "CANCELLED" },
        startTime: { lt: validation.data.to },
        endTime: { gt: validation.data.from },
      },
      orderBy: { startTime: "asc" },
      include: { bookedBy: { select: { id: true, name: true } } },
    });

    return Api.ok(bookings);
  } catch (error) {
    logger.error("assets.bookings.list.failed", error, { requestId });
    return Api.internalError("Failed to load bookings");
  }
}
