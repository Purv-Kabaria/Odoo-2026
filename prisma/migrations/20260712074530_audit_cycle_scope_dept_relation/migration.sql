-- Note: Prisma's diff engine wants to DROP INDEX "Asset_name_trgm_idx" here
-- again — same unmanaged-object drift false-positive as prior migrations.
-- Deliberately omitted; the index stays.

-- CreateIndex
CREATE INDEX "AuditCycle_scopeDeptId_idx" ON "AuditCycle"("scopeDeptId");

-- AddForeignKey
ALTER TABLE "AuditCycle" ADD CONSTRAINT "AuditCycle_scopeDeptId_fkey" FOREIGN KEY ("scopeDeptId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
