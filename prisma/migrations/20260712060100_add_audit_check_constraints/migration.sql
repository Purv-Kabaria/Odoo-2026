-- Domain constraints Prisma schema syntax cannot express.
-- These keep invalid data out even if a future import script bypasses API validation.

ALTER TABLE "AuditCycle"
  ADD CONSTRAINT "AuditCycle_endDate_after_startDate_check" CHECK ("endDate" >= "startDate"),
  ADD CONSTRAINT "AuditCycle_scope_consistency_check" CHECK (
    ("scopeType" = 'DEPARTMENT' AND "departmentId" IS NOT NULL)
    OR ("scopeType" = 'LOCATION' AND "location" IS NOT NULL)
  );

ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_acquisitionCostCents_nonnegative_check" CHECK ("acquisitionCostCents" IS NULL OR "acquisitionCostCents" >= 0);
