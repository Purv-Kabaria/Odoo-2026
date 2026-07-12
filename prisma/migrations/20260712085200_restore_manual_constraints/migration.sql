-- Restores every hand-written constraint/index that the previous migration
-- (20260712084701_user_approval_and_uuid_columns) silently destroyed as a
-- side effect of its `DROP COLUMN ... ADD COLUMN ... UUID` approach to
-- changing column types: Postgres auto-drops any index/constraint that
-- references a column when that column is dropped, with no warning in the
-- migration diff output. All statements here are idempotent (IF NOT
-- EXISTS / DROP...IF EXISTS + recreate) so this is safe to run against a
-- database where some objects survived and some didn't.

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- No double allocation: at most one ACTIVE allocation per asset.
DROP INDEX IF EXISTS "Allocation_one_active_per_asset";
CREATE UNIQUE INDEX "Allocation_one_active_per_asset"
  ON "Allocation" ("assetId")
  WHERE status = 'ACTIVE';

-- Allocation target is exactly one of employee or department.
ALTER TABLE "Allocation" DROP CONSTRAINT IF EXISTS "Allocation_target_xor_check";
ALTER TABLE "Allocation"
  ADD CONSTRAINT "Allocation_target_xor_check"
  CHECK ((("toEmployeeId" IS NOT NULL)::int + ("toDepartmentId" IS NOT NULL)::int) = 1);

-- Booking time ordering.
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_time_order_check";
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_time_order_check"
  CHECK ("endTime" > "startTime");

-- No overlapping non-cancelled bookings per asset. Half-open interval
-- ('[)') matches the brief's exact boundary rule: a booking ending at T
-- and one starting at T do not conflict.
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_no_overlap_excl";
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_no_overlap_excl"
  EXCLUDE USING gist (
    "assetId" WITH =,
    tsrange("startTime", "endTime", '[)') WITH &&
  )
  WHERE (status <> 'CANCELLED');

-- Postgres fuzzy-search fallback for the asset directory.
CREATE INDEX IF NOT EXISTS "Asset_name_trgm_idx"
  ON "Asset" USING gin ("name" gin_trgm_ops);

-- Overdue-allocation sweep narrows to open allocations first.
CREATE INDEX IF NOT EXISTS "Allocation_open_expectedReturn_idx"
  ON "Allocation" ("expectedReturnDate")
  WHERE "returnedAt" IS NULL;

-- Every user needs a password unless still pending admin-invite acceptance.
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_password_or_pending_check";
ALTER TABLE "User"
  ADD CONSTRAINT "User_password_or_pending_check"
  CHECK ("passwordHash" IS NOT NULL OR status = 'PENDING_APPROVAL');

-- An audit cycle's scope is at most one of department or location.
ALTER TABLE "AuditCycle" DROP CONSTRAINT IF EXISTS "AuditCycle_scope_at_most_one_check";
ALTER TABLE "AuditCycle"
  ADD CONSTRAINT "AuditCycle_scope_at_most_one_check"
  CHECK (NOT ("scopeDeptId" IS NOT NULL AND "scopeLocation" IS NOT NULL));

-- endDate >= startDate for an audit cycle.
ALTER TABLE "AuditCycle" DROP CONSTRAINT IF EXISTS "AuditCycle_dates_check";
ALTER TABLE "AuditCycle"
  ADD CONSTRAINT "AuditCycle_dates_check"
  CHECK ("endDate" >= "startDate");
