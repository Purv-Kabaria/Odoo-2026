-- AlterEnum
-- New enum values can't be referenced until this transaction commits
-- (Postgres restriction), so the check constraint that uses
-- 'PENDING_APPROVAL' lives in the next migration, not this one.
ALTER TYPE "ActiveStatus" ADD VALUE 'PENDING_APPROVAL';

-- Note: Prisma's diff engine wanted to DROP INDEX "Asset_name_trgm_idx"
-- here because it's unmanaged (added via raw SQL in the manual_constraints
-- migration, not expressible in schema.prisma) — that's Prisma treating a
-- real index as drift, not an actual schema change. Deliberately omitted.

-- AlterTable
ALTER TABLE "AuditCycle" ADD COLUMN     "closedById" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "invitedAt" TIMESTAMP(3),
ADD COLUMN     "invitedById" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "AuditCycle_closedById_idx" ON "AuditCycle"("closedById");

-- CreateIndex
CREATE INDEX "User_invitedById_idx" ON "User"("invitedById");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditCycle" ADD CONSTRAINT "AuditCycle_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
