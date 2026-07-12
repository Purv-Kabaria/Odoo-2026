-- The prior migration (20260712053731_uuid_v7_ids) rebuilt the id/FK
-- columns on User/Product/Organization's tables as part of the UUIDv7
-- conversion. Prisma's migration diffing only knows about objects declared
-- in schema.prisma, and pg_trgm GIN indexes aren't expressible there (see
-- 20260707113000_add_entity_hot_path_indexes), so the diff engine dropped
-- them as "unmanaged drift" even though the columns they cover were
-- untouched. Recreate them so the Postgres ILIKE fallback search path
-- (see AGENTS.md search fallback rules) doesn't regress to sequential scans.
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
