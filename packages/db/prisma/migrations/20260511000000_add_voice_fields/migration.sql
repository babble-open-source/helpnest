-- AlterTable: Add voice fields to Workspace
ALTER TABLE "Workspace" ADD COLUMN "voiceEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN "voiceGreeting" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "voiceLanguage" TEXT DEFAULT 'en';
ALTER TABLE "Workspace" ADD COLUMN "voiceSettings" JSONB;
ALTER TABLE "Workspace" ADD COLUMN "voiceMinutesUsed" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: VoiceSession
CREATE TABLE "VoiceSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT,
    "roomName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceSession_roomName_key" ON "VoiceSession"("roomName");
CREATE INDEX "VoiceSession_workspaceId_idx" ON "VoiceSession"("workspaceId");
CREATE INDEX "VoiceSession_roomName_idx" ON "VoiceSession"("roomName");

-- AddForeignKey
ALTER TABLE "VoiceSession" ADD CONSTRAINT "VoiceSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoiceSession" ADD CONSTRAINT "VoiceSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
