import { cookies } from "next/headers";

import { Api } from "@/lib/api";
import { hashToken } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";

export async function POST() {
  const requestId = crypto.randomUUID();

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
    }

    const response = Api.ok({ message: "Signed out" });
    response.cookies.delete(SESSION_COOKIE_NAME);
    logger.info("auth.logout", { requestId });

    return response;
  } catch (error) {
    logger.error("auth.logout.failed", error, { requestId });
    return Api.internalError("Failed to sign out");
  }
}
