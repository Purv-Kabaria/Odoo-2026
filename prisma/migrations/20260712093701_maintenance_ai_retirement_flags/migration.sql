-- AlterTable
ALTER TABLE "MaintenanceRequest" ADD COLUMN     "aiRecommendReason" TEXT,
ADD COLUMN     "aiRecommendRetirement" BOOLEAN,
ADD COLUMN     "aiRecommendedAt" TIMESTAMP(3);
