CREATE TABLE "ObjectAsset" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObjectAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ObjectAsset_key_key" ON "ObjectAsset"("key");
CREATE INDEX "ObjectAsset_uploadedById_idx" ON "ObjectAsset"("uploadedById");
CREATE INDEX "ObjectAsset_createdAt_idx" ON "ObjectAsset"("createdAt");
CREATE INDEX "ObjectAsset_uploadedById_createdAt_idx" ON "ObjectAsset"("uploadedById", "createdAt");
CREATE INDEX "ObjectAsset_contentType_idx" ON "ObjectAsset"("contentType");

ALTER TABLE "ObjectAsset"
ADD CONSTRAINT "ObjectAsset_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
