-- Composite indexes match the table hot paths:
-- equality filters first, then the default createdAt ordering column.
CREATE INDEX IF NOT EXISTS "User_role_createdAt_idx" ON "User"("role", "createdAt");
CREATE INDEX IF NOT EXISTS "User_gender_createdAt_idx" ON "User"("gender", "createdAt");

CREATE INDEX IF NOT EXISTS "Product_status_createdAt_idx" ON "Product"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Product_category_createdAt_idx" ON "Product"("category", "createdAt");

CREATE INDEX IF NOT EXISTS "Organization_plan_createdAt_idx" ON "Organization"("plan", "createdAt");
CREATE INDEX IF NOT EXISTS "Organization_industry_createdAt_idx" ON "Organization"("industry", "createdAt");
CREATE INDEX IF NOT EXISTS "Organization_region_createdAt_idx" ON "Organization"("region", "createdAt");

-- Meilisearch is primary, but Postgres fallback search should stay usable.
-- pg_trgm lets ILIKE/contains fallback searches use GIN indexes on text columns.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "User_name_trgm_idx" ON "User" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "User_email_trgm_idx" ON "User" USING gin ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "User_location_trgm_idx" ON "User" USING gin ("location" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx" ON "Product" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Product_sku_trgm_idx" ON "Product" USING gin ("sku" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Product_category_trgm_idx" ON "Product" USING gin ("category" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Organization_name_trgm_idx" ON "Organization" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Organization_slug_trgm_idx" ON "Organization" USING gin ("slug" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Organization_industry_trgm_idx" ON "Organization" USING gin ("industry" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Organization_region_trgm_idx" ON "Organization" USING gin ("region" gin_trgm_ops);
