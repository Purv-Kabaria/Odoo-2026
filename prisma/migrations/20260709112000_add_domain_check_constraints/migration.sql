-- Domain constraints that Prisma schema syntax cannot express yet.
-- These keep invalid data out even if a future import script bypasses API validation.

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_priceCents_nonnegative_check" CHECK ("priceCents" >= 0),
  ADD CONSTRAINT "Product_stock_nonnegative_check" CHECK ("stock" >= 0);

ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_seats_positive_check" CHECK ("seats" >= 1);

ALTER TABLE "ObjectAsset"
  ADD CONSTRAINT "ObjectAsset_sizeBytes_positive_check" CHECK ("sizeBytes" > 0);

ALTER TABLE "PasswordCredential"
  ADD CONSTRAINT "PasswordCredential_iterations_minimum_check" CHECK ("iterations" >= 100000);

ALTER TABLE "AuthSession"
  ADD CONSTRAINT "AuthSession_expiry_after_created_check" CHECK ("expiresAt" > "createdAt");

ALTER TABLE "PasswordResetToken"
  ADD CONSTRAINT "PasswordResetToken_expiry_after_created_check" CHECK ("expiresAt" > "createdAt");
