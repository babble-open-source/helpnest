-- AlterTable: Add AI credits tracking to Workspace
ALTER TABLE "Workspace" ADD COLUMN "aiCreditsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Workspace" ADD COLUMN "aiCreditsLimit" INTEGER NOT NULL DEFAULT 5;
