-- CreateEnum
CREATE TYPE "CrawlMode" AS ENUM ('SINGLE', 'DEEP', 'FLOW');

-- CreateEnum
CREATE TYPE "CrawlJobStatus" AS ENUM ('PENDING', 'CRAWLING', 'EXTRACTING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CrawlPageStatus" AS ENUM ('PENDING', 'FETCHED', 'EXTRACTED', 'GENERATED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "CrawlJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "mode" "CrawlMode" NOT NULL DEFAULT 'SINGLE',
    "status" "CrawlJobStatus" NOT NULL DEFAULT 'PENDING',
    "config" JSONB,
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "processedPages" INTEGER NOT NULL DEFAULT 0,
    "articlesCreated" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CrawlJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlPage" (
    "id" TEXT NOT NULL,
    "crawlJobId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "CrawlPageStatus" NOT NULL DEFAULT 'PENDING',
    "contentHash" TEXT,
    "contentType" TEXT,
    "language" TEXT,
    "rawContent" TEXT,
    "articleId" TEXT,
    "skipReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawlPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrawlJob_workspaceId_idx" ON "CrawlJob"("workspaceId");

-- CreateIndex
CREATE INDEX "CrawlJob_status_idx" ON "CrawlJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CrawlPage_articleId_key" ON "CrawlPage"("articleId");

-- CreateIndex
CREATE INDEX "CrawlPage_crawlJobId_idx" ON "CrawlPage"("crawlJobId");

-- CreateIndex
CREATE INDEX "CrawlPage_contentHash_idx" ON "CrawlPage"("contentHash");

-- AddForeignKey
ALTER TABLE "CrawlJob" ADD CONSTRAINT "CrawlJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawlJob" ADD CONSTRAINT "CrawlJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawlPage" ADD CONSTRAINT "CrawlPage_crawlJobId_fkey" FOREIGN KEY ("crawlJobId") REFERENCES "CrawlJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawlPage" ADD CONSTRAINT "CrawlPage_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
