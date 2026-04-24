-- CreateIndex
CREATE INDEX "Conversation_workspaceId_visitorId_idx" ON "Conversation"("workspaceId", "visitorId");

-- DropIndex (compound covers single-column queries when workspaceId is always included)
DROP INDEX IF EXISTS "Conversation_visitorId_idx";
