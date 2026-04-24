-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "visitorId" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_visitorId_idx" ON "Conversation"("visitorId");
