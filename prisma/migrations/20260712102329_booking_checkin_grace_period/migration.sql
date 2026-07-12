-- DropIndex
DROP INDEX "Asset_name_trgm_idx";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "checkInDeadline" TIMESTAMP(3),
ADD COLUMN     "checkInGraceExtended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "checkedIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Booking_status_checkedIn_checkInDeadline_idx" ON "Booking"("status", "checkedIn", "checkInDeadline");
