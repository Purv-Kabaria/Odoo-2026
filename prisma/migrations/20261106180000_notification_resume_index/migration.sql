-- Supports SSE replay: WHERE "userId" = $1 AND "id" > $2 ORDER BY "id".
-- Notification ids are UUIDv7, so id order is creation order.
-- CreateIndex
CREATE INDEX "Notification_userId_id_idx" ON "Notification"("userId", "id");
