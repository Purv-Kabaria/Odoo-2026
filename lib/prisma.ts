import { PrismaClient } from "@prisma/client"

import { env } from "@/lib/env"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Singleton client: Next.js dev hot-reload re-evaluates modules on every
// change, and a fresh PrismaClient per reload would exhaust the connection
// pool within minutes. Reuse the cached instance across reloads instead.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: env.DATABASE_URL })

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
