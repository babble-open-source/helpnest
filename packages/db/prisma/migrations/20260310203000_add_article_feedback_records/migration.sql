CREATE TYPE "ArticleFeedbackType" AS ENUM ('HELPFUL', 'NOT_HELPFUL');

CREATE TABLE "ArticleFeedback" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "voterToken" TEXT NOT NULL,
  "type" "ArticleFeedbackType" NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ArticleFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArticleFeedback_articleId_voterToken_key" ON "ArticleFeedback"("articleId", "voterToken");
CREATE INDEX "ArticleFeedback_workspaceId_createdAt_idx" ON "ArticleFeedback"("workspaceId", "createdAt");
CREATE INDEX "ArticleFeedback_articleId_type_idx" ON "ArticleFeedback"("articleId", "type");

ALTER TABLE "ArticleFeedback"
ADD CONSTRAINT "ArticleFeedback_articleId_fkey"
FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ArticleFeedback"
ADD CONSTRAINT "ArticleFeedback_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
