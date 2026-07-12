-- Same root cause as 20260712053800_restore_trgm_indexes: pg_trgm GIN
-- indexes aren't expressible in schema.prisma, so Prisma's migration diff
-- engine treats them as unmanaged drift and drops them on every
-- `migrate dev` run, even when the touched tables are unrelated (this
-- migration's own add_assetflow_audit predecessor dropped them again while
-- only adding new Department/Asset/Audit tables). Recreate them.
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
