import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { AssetLookupQuerySchema } from "@/types/asset-types";

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const searchParams = new URL(req.url).searchParams;
    const validation = AssetLookupQuerySchema.safeParse({
      tag: searchParams.get("tag") ?? undefined,
      serial: searchParams.get("serial") ?? undefined,
      qr: searchParams.get("qr") ?? undefined,
    });
    if (!validation.success) {
      return Api.badRequest("Provide exactly one of tag, serial, or qr", validation.error.format());
    }

    const { tag, serial, qr } = validation.data;
    const where = tag
      ? { orgId_assetTag: { orgId: user.orgId, assetTag: tag.toUpperCase() } }
      : undefined;

    const asset = where
      ? await prisma.asset.findUnique({ where })
      : await prisma.asset.findFirst({
          where: {
            orgId: user.orgId,
            ...(serial ? { serialNumber: serial } : {}),
            ...(qr ? { qrCode: qr } : {}),
          },
        });

    if (!asset) return Api.notFound("No asset matched");
    return Api.ok(asset);
  } catch (error) {
    logger.error("assets.lookup.failed", error, { requestId });
    return Api.internalError("Lookup failed");
  }
}
