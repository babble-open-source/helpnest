-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiPrompt" TEXT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "autoDraftExternalEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoDraftGapThreshold" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "autoDraftGapsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "batchWindowMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "productContext" TEXT;
