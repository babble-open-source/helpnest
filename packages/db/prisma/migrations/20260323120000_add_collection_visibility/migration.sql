-- CreateEnum
CREATE TYPE "CollectionVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- AlterTable: add visibility column with default
ALTER TABLE "Collection" ADD COLUMN "visibility" "CollectionVisibility" NOT NULL DEFAULT 'PUBLIC';

-- Backfill from isPublic
UPDATE "Collection" SET "visibility" = 'PUBLIC' WHERE "isPublic" = true;
UPDATE "Collection" SET "visibility" = 'INTERNAL' WHERE "isPublic" = false;

-- Drop the old isPublic column
ALTER TABLE "Collection" DROP COLUMN "isPublic";
