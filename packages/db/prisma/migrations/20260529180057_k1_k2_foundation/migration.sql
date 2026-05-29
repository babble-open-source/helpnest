-- CreateEnum
CREATE TYPE "ContactOrgSource" AS ENUM ('DOMAIN', 'MANUAL', 'API', 'CRM', 'BACKFILL');

-- CreateEnum
CREATE TYPE "ContactOrgRole" AS ENUM ('MEMBER', 'ADMIN', 'TECHNICAL', 'BILLING');

-- CreateEnum
CREATE TYPE "EventActorType" AS ENUM ('CUSTOMER', 'AI', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConversationEventVerb" AS ENUM ('CONVERSATION_CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'CONTACT_LINKED', 'ORG_LINKED', 'FIRST_RESPONSE_SENT', 'NOTE_ADDED', 'AI_ANSWERED', 'AI_ESCALATED', 'HANDOFF_TO_HUMAN', 'RESOLVED', 'REOPENED');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "contactId" TEXT,
ADD COLUMN     "number" INTEGER,
ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "authorMemberId" TEXT,
ADD COLUMN     "isInternal" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "externalId" TEXT,
    "email" TEXT,
    "fullName" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "visitorId" TEXT,
    "customFields" JSONB DEFAULT '{}',
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "domains" TEXT[],
    "plan" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "customFields" JSONB DEFAULT '{}',
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactOrganization" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "role" "ContactOrgRole",
    "source" "ContactOrgSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceCounter" (
    "workspaceId" TEXT NOT NULL,
    "lastConversationNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkspaceCounter_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateTable
CREATE TABLE "ConversationEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "actorType" "EventActorType" NOT NULL,
    "actorMemberId" TEXT,
    "actorLabel" TEXT,
    "verb" "ConversationEventVerb" NOT NULL,
    "payload" JSONB,
    "durationSeconds" INTEGER,
    "durationBusinessSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_workspaceId_idx" ON "Contact"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_workspaceId_email_key" ON "Contact"("workspaceId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_workspaceId_externalId_key" ON "Contact"("workspaceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_workspaceId_visitorId_key" ON "Contact"("workspaceId", "visitorId");

-- CreateIndex
CREATE INDEX "Organization_workspaceId_idx" ON "Organization"("workspaceId");

-- CreateIndex
CREATE INDEX "Organization_workspaceId_ownerId_idx" ON "Organization"("workspaceId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_workspaceId_externalId_key" ON "Organization"("workspaceId", "externalId");

-- CreateIndex
CREATE INDEX "ContactOrganization_workspaceId_organizationId_idx" ON "ContactOrganization"("workspaceId", "organizationId");

-- CreateIndex
CREATE INDEX "ContactOrganization_workspaceId_contactId_idx" ON "ContactOrganization"("workspaceId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactOrganization_contactId_organizationId_key" ON "ContactOrganization"("contactId", "organizationId");

-- CreateIndex
CREATE INDEX "ConversationEvent_conversationId_createdAt_idx" ON "ConversationEvent"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationEvent_workspaceId_verb_createdAt_idx" ON "ConversationEvent"("workspaceId", "verb", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationEvent_workspaceId_createdAt_idx" ON "ConversationEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_number_idx" ON "Conversation"("workspaceId", "number");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_contactId_idx" ON "Conversation"("workspaceId", "contactId");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_organizationId_idx" ON "Conversation"("workspaceId", "organizationId");

-- CreateIndex
CREATE INDEX "Message_conversationId_isInternal_idx" ON "Message"("conversationId", "isInternal");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorMemberId_fkey" FOREIGN KEY ("authorMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactOrganization" ADD CONSTRAINT "ContactOrganization_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactOrganization" ADD CONSTRAINT "ContactOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceCounter" ADD CONSTRAINT "WorkspaceCounter_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationEvent" ADD CONSTRAINT "ConversationEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationEvent" ADD CONSTRAINT "ConversationEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationEvent" ADD CONSTRAINT "ConversationEvent_actorMemberId_fkey" FOREIGN KEY ("actorMemberId") REFERENCES "Member"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Append-only enforcement for ConversationEvent (audit/event log).
--
-- REVOKE UPDATE, DELETE FROM PUBLIC prevents application-layer code that
-- connects as a non-owner role from mutating or deleting audit rows.
-- NOTE: PostgreSQL table OWNERS bypass privilege checks entirely — if the
-- application connects as the role that owns this table (e.g. "helpnest" in
-- the default self-hosted setup), this REVOKE does NOT restrict it at the
-- DB level. The append-only guarantee is therefore enforced primarily by
-- application discipline: only `emitConversationEvent()` in
-- `apps/web/src/lib/conversation-events.ts` should write to this table, and
-- no code path should UPDATE or DELETE rows. Teams running a dedicated
-- app role that is NOT the table owner should additionally execute:
--   REVOKE UPDATE, DELETE ON "ConversationEvent" FROM <app_role>;
--
-- Parent-cascade deletes (Workspace/Conversation deleted) still work because
-- they execute under the owning session/superuser — self-hosted hard-deletes
-- of audit rows with their parent workspace are acceptable.
-- ---------------------------------------------------------------------------
REVOKE UPDATE, DELETE ON "ConversationEvent" FROM PUBLIC;
GRANT INSERT, SELECT ON "ConversationEvent" TO PUBLIC;

-- ---------------------------------------------------------------------------
-- Seed WorkspaceCounter rows for all existing workspaces so that the
-- assignConversationNumber upsert always hits the ON CONFLICT path (normal
-- operating path) rather than the INSERT path after the first conversation.
-- Idempotent: ON CONFLICT DO NOTHING makes it safe to run on a DB that
-- already has counter rows (e.g. after db:reset + re-migrate).
-- ---------------------------------------------------------------------------
INSERT INTO "WorkspaceCounter" ("workspaceId", "lastConversationNumber")
SELECT "id", 0 FROM "Workspace"
ON CONFLICT DO NOTHING;
