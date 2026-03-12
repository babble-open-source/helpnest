-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ESCALATED', 'RESOLVED_AI', 'RESOLVED_HUMAN', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('CUSTOMER', 'AI', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('ANTHROPIC', 'OPENAI', 'GOOGLE', 'MISTRAL');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "aiApiKey" TEXT,
ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiEscalationThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
ADD COLUMN     "aiGreeting" TEXT,
ADD COLUMN     "aiInstructions" TEXT,
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiProvider" "AiProvider";

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "customerName" TEXT,
    "customerEmail" TEXT,
    "sessionToken" TEXT NOT NULL,
    "subject" TEXT,
    "assignedToId" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "escalationReason" TEXT,
    "resolutionSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB,
    "confidence" DOUBLE PRECISION,
    "feedbackHelpful" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationArticle" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,

    CONSTRAINT "ConversationArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeGap" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolvedArticleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeGap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_sessionToken_key" ON "Conversation"("sessionToken");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_status_idx" ON "Conversation"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_createdAt_idx" ON "Conversation"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_assignedToId_idx" ON "Conversation"("assignedToId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationArticle_articleId_idx" ON "ConversationArticle"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationArticle_conversationId_articleId_key" ON "ConversationArticle"("conversationId", "articleId");

-- CreateIndex
CREATE INDEX "KnowledgeGap_workspaceId_resolvedAt_idx" ON "KnowledgeGap"("workspaceId", "resolvedAt");

-- CreateIndex
CREATE INDEX "KnowledgeGap_workspaceId_occurrences_idx" ON "KnowledgeGap"("workspaceId", "occurrences");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeGap_workspaceId_queryHash_key" ON "KnowledgeGap"("workspaceId", "queryHash");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationArticle" ADD CONSTRAINT "ConversationArticle_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationArticle" ADD CONSTRAINT "ConversationArticle_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeGap" ADD CONSTRAINT "KnowledgeGap_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeGap" ADD CONSTRAINT "KnowledgeGap_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeGap" ADD CONSTRAINT "KnowledgeGap_resolvedArticleId_fkey" FOREIGN KEY ("resolvedArticleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
