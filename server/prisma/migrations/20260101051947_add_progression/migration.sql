/*
  Warnings:

  - Added the required column `stat` to the `Quest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Quest" ADD COLUMN     "stat" TEXT NOT NULL,
ADD COLUMN     "xpReward" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cha" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "end" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "int" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "str" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "wis" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;
