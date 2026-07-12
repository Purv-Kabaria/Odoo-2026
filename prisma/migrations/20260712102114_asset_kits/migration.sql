-- Note: Prisma's shadow-db diff wants to drop "Asset_name_trgm_idx" here
-- because it's a raw-SQL index with no schema.prisma model (see the
-- manual-constraints migrations) — not a real change this migration makes.
-- Deliberately not included.

-- AlterTable
ALTER TABLE "Allocation" ADD COLUMN     "kitAllocationId" UUID;

-- CreateTable
CREATE TABLE "AssetKit" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetKitItem" (
    "id" UUID NOT NULL,
    "kitId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetKitItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitAllocation" (
    "id" UUID NOT NULL,
    "kitId" UUID NOT NULL,
    "toEmployeeId" UUID,
    "toDepartmentId" UUID,
    "allocatedById" UUID NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetKit_orgId_idx" ON "AssetKit"("orgId");

-- CreateIndex
CREATE INDEX "AssetKit_createdById_idx" ON "AssetKit"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "AssetKit_orgId_name_key" ON "AssetKit"("orgId", "name");

-- CreateIndex
CREATE INDEX "AssetKitItem_assetId_idx" ON "AssetKitItem"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetKitItem_kitId_assetId_key" ON "AssetKitItem"("kitId", "assetId");

-- CreateIndex
CREATE INDEX "KitAllocation_kitId_idx" ON "KitAllocation"("kitId");

-- CreateIndex
CREATE INDEX "KitAllocation_toEmployeeId_idx" ON "KitAllocation"("toEmployeeId");

-- CreateIndex
CREATE INDEX "KitAllocation_toDepartmentId_idx" ON "KitAllocation"("toDepartmentId");

-- CreateIndex
CREATE INDEX "KitAllocation_allocatedById_idx" ON "KitAllocation"("allocatedById");

-- CreateIndex
CREATE INDEX "Allocation_kitAllocationId_idx" ON "Allocation"("kitAllocationId");

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_kitAllocationId_fkey" FOREIGN KEY ("kitAllocationId") REFERENCES "KitAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetKit" ADD CONSTRAINT "AssetKit_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetKit" ADD CONSTRAINT "AssetKit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetKitItem" ADD CONSTRAINT "AssetKitItem_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "AssetKit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetKitItem" ADD CONSTRAINT "AssetKitItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAllocation" ADD CONSTRAINT "KitAllocation_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "AssetKit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAllocation" ADD CONSTRAINT "KitAllocation_toEmployeeId_fkey" FOREIGN KEY ("toEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAllocation" ADD CONSTRAINT "KitAllocation_toDepartmentId_fkey" FOREIGN KEY ("toDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAllocation" ADD CONSTRAINT "KitAllocation_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Kit allocation target is exactly one of employee or department — the same
-- rule as Allocation_target_xor_check, applied to the batch header row.
ALTER TABLE "KitAllocation"
  ADD CONSTRAINT "KitAllocation_target_xor_check"
  CHECK ((("toEmployeeId" IS NOT NULL)::int + ("toDepartmentId" IS NOT NULL)::int) = 1);
