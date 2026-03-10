/*
  Warnings:

  - A unique constraint covering the columns `[articleId,version]` on the table `ArticleVersion` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ArticleVersion_articleId_version_idx";

-- CreateIndex
CREATE UNIQUE INDEX "ArticleVersion_articleId_version_key" ON "ArticleVersion"("articleId", "version");
