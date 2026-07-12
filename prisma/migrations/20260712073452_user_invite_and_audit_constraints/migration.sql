-- Note: Prisma's diff engine wants to DROP INDEX "Asset_name_trgm_idx" here
-- again — same unmanaged-object drift false-positive as the prior
-- migration. Deliberately omitted; the index stays.

-- Every user needs a password UNLESS they're an admin-invited account that
-- hasn't accepted its invite yet (see User.passwordHash comment in
-- schema.prisma). The enum value this references was added in the prior
-- migration, which has now committed.
ALTER TABLE "User"
  ADD CONSTRAINT "User_password_or_pending_check"
  CHECK ("passwordHash" IS NOT NULL OR status = 'PENDING_APPROVAL');

-- An audit cycle's scope is at most one of department or location (both
-- null means org-wide). Never both at once — that would be an ambiguous
-- AND-scope, not a real product concept.
ALTER TABLE "AuditCycle"
  ADD CONSTRAINT "AuditCycle_scope_at_most_one_check"
  CHECK (NOT ("scopeDeptId" IS NOT NULL AND "scopeLocation" IS NOT NULL));
