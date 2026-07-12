-- Domain constraints that Prisma schema syntax cannot express yet.
-- These keep invalid data out even if a future import script bypasses API validation.

-- Every user must either have a password set (self-signup) or have been invited
-- by another user. Prevents ghost accounts with neither credential nor invite trail.
ALTER TABLE "User"
  ADD CONSTRAINT "User_password_or_invite_check"
  CHECK ("passwordHash" IS NOT NULL OR "invitedById" IS NOT NULL);

-- Session expiry must be after creation.
ALTER TABLE "AuthSession"
  ADD CONSTRAINT "AuthSession_expiry_after_created_check"
  CHECK ("expiresAt" > "createdAt");

-- Reset token expiry must be after creation.
ALTER TABLE "PasswordResetToken"
  ADD CONSTRAINT "PasswordResetToken_expiry_after_created_check"
  CHECK ("expiresAt" > "createdAt");
