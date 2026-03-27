-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('META_TAG', 'DNS_TXT');

-- CreateTable
CREATE TABLE "DomainVerification" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "method" "VerificationMethod" NOT NULL,
    "token" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DomainVerification_workspaceId_domain_key" ON "DomainVerification"("workspaceId", "domain");

-- CreateIndex
CREATE INDEX "DomainVerification_workspaceId_idx" ON "DomainVerification"("workspaceId");

-- AddForeignKey
ALTER TABLE "DomainVerification" ADD CONSTRAINT "DomainVerification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add goalPrompt, discoveredUrls, approvedUrls to CrawlJob
ALTER TABLE "CrawlJob" ADD COLUMN "goalPrompt" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CrawlJob" ADD COLUMN "discoveredUrls" JSONB;
ALTER TABLE "CrawlJob" ADD COLUMN "approvedUrls" JSONB;

-- AlterTable: Add similarArticleId, remove contentHash from CrawlPage
ALTER TABLE "CrawlPage" ADD COLUMN "similarArticleId" TEXT;
ALTER TABLE "CrawlPage" DROP COLUMN IF EXISTS "contentHash";

-- DropIndex
DROP INDEX IF EXISTS "CrawlPage_contentHash_idx";
