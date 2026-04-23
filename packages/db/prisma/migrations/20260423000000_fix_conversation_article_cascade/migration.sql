-- DropForeignKey
ALTER TABLE "ConversationArticle" DROP CONSTRAINT "ConversationArticle_articleId_fkey";

-- AddForeignKey
ALTER TABLE "ConversationArticle" ADD CONSTRAINT "ConversationArticle_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
