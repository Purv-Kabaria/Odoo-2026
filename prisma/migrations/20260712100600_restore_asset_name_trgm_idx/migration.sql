-- Same recurring cause documented elsewhere in this history: pg_trgm GIN
-- indexes aren't expressible in schema.prisma, so any `migrate dev` run
-- treats them as unmanaged drift and drops them, even when the touched
-- tables are unrelated to the index itself. Recreate it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Asset_name_trgm_idx"
  ON "Asset" USING gin ("name" gin_trgm_ops);
