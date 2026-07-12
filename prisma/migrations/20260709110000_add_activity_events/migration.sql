-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM (
  'CREATED',
  'UPDATED',
  'DELETED',
  'BULK_UPDATED',
  'BULK_DELETED',
  'PROFILE_UPDATED',
  'STORAGE_UPLOADED',
  'STORAGE_DELETED',
  'LLM_REQUESTED'
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
  "id" TEXT NOT NULL,
  "action" "ActivityAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "actorId" TEXT,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityEvent_createdAt_id_idx" ON "ActivityEvent"("createdAt", "id");

-- CreateIndex
CREATE INDEX "ActivityEvent_actorId_createdAt_idx" ON "ActivityEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_entityType_entityId_createdAt_idx" ON "ActivityEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_action_createdAt_idx" ON "ActivityEvent"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
