-- Note: Prisma's shadow-db diff wants to drop "Asset_name_trgm_idx" here —
-- recurring unmanaged-object-drift false positive documented elsewhere in
-- this history. Deliberately omitted; the index stays.
--
-- Booking.checkedIn already exists (added in
-- 20260712100532_notification_types_and_booking_checkin) — only the two
-- new grace-period columns are added here.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "checkInDeadline" TIMESTAMP(3),
ADD COLUMN     "checkInGraceExtended" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Booking_status_checkedIn_checkInDeadline_idx" ON "Booking"("status", "checkedIn", "checkInDeadline");
