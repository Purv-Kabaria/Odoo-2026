-- DropIndex
DROP INDEX "AuditDiscrepancy_type_idx";

-- DropIndex
DROP INDEX "Organization_industry_trgm_idx";

-- DropIndex
DROP INDEX "Organization_name_trgm_idx";

-- DropIndex
DROP INDEX "Organization_region_trgm_idx";

-- DropIndex
DROP INDEX "Organization_slug_trgm_idx";

-- DropIndex
DROP INDEX "Product_category_trgm_idx";

-- DropIndex
DROP INDEX "Product_name_trgm_idx";

-- DropIndex
DROP INDEX "Product_sku_trgm_idx";

-- DropIndex
DROP INDEX "User_email_trgm_idx";

-- DropIndex
DROP INDEX "User_location_trgm_idx";

-- DropIndex
DROP INDEX "User_name_trgm_idx";

-- CreateIndex
CREATE INDEX "Asset_acquisitionDate_idx" ON "Asset"("acquisitionDate");

-- CreateIndex
CREATE INDEX "AuditDiscrepancy_type_createdAt_idx" ON "AuditDiscrepancy"("type", "createdAt");
