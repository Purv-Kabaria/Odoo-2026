-- Manual constraints and indexes Prisma's schema syntax cannot express:
-- partial-unique, check, GiST exclusion, and pg_trgm indexes. See the
-- header comment in schema.prisma for why these live here instead.

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- No double allocation: at most one ACTIVE allocation per asset. This is
-- the authoritative guard for the allocate flow — the app pre-checks for a
-- fast, friendly error, but this index is what actually prevents a race
-- between two concurrent allocation requests.
CREATE UNIQUE INDEX IF NOT EXISTS "Allocation_one_active_per_asset"
  ON "Allocation" ("assetId")
  WHERE status = 'ACTIVE';

-- Allocation target is exactly one of employee or department, never both,
-- never neither.
ALTER TABLE "Allocation"
  ADD CONSTRAINT "Allocation_target_xor_check"
  CHECK ((("toEmployeeId" IS NOT NULL)::int + ("toDepartmentId" IS NOT NULL)::int) = 1);

-- Booking time ordering.
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_time_order_check"
  CHECK ("endTime" > "startTime");

-- No overlapping non-cancelled bookings per asset. Half-open interval
-- ('[)') matches the brief's exact boundary rule: a booking ending at T
-- and one starting at T do not conflict. This is the authoritative guard
-- for the booking flow — the app pre-checks for a fast, friendly conflict
-- message, but this constraint is what actually prevents a race between
-- two concurrent booking requests for the same slot.
-- `startTime`/`endTime` are `timestamp` (no time zone) columns, so the
-- range function must be `tsrange`, not `tstzrange` — a tz-aware cast on a
-- naive timestamp isn't IMMUTABLE (depends on the session's TimeZone GUC)
-- and Postgres rejects it in an index/exclusion expression.
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_no_overlap_excl"
  EXCLUDE USING gist (
    "assetId" WITH =,
    tsrange("startTime", "endTime", '[)') WITH &&
  )
  WHERE (status <> 'CANCELLED');

-- Postgres fuzzy-search fallback for the asset directory (Meilisearch is
-- primary; this keeps the degraded path usable without a sequential scan).
CREATE INDEX IF NOT EXISTS "Asset_name_trgm_idx"
  ON "Asset" USING gin ("name" gin_trgm_ops);

-- Overdue-allocation sweep narrows to open allocations first; the
-- "expectedReturnDate < now()" comparison happens in the query — now() is
-- not IMMUTABLE, so it can't be part of the index predicate itself.
CREATE INDEX IF NOT EXISTS "Allocation_open_expectedReturn_idx"
  ON "Allocation" ("expectedReturnDate")
  WHERE "returnedAt" IS NULL;
