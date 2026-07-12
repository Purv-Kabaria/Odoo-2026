-- Asset_name_trgm_idx is a hand-written pg_trgm GIN index (see the
-- restore_asset_name_trgm_idx migration) that can't be expressed in
-- schema.prisma syntax, so Prisma's diff sees it as untracked drift and
-- wants to drop it. It's still required by the Postgres fuzzy-search
-- fallback in app/api/assets/route.ts — intentionally NOT dropped here.

-- DropIndex
DROP INDEX "AuditCycle_orgId_status_idx";

-- CreateIndex
CREATE INDEX "AuditCycle_orgId_status_createdAt_idx" ON "AuditCycle"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_status_endTime_idx" ON "Booking"("status", "endTime");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_approvedById_idx" ON "MaintenanceRequest"("approvedById");

-- CreateIndex
CREATE INDEX "Notification_userId_type_relatedEntityId_isRead_idx" ON "Notification"("userId", "type", "relatedEntityId", "isRead");

-- CreateIndex
CREATE INDEX "TransferRequest_fromEmployeeId_idx" ON "TransferRequest"("fromEmployeeId");

-- CreateIndex
CREATE INDEX "TransferRequest_approvedById_idx" ON "TransferRequest"("approvedById");
