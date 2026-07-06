/*
  Warnings:

  - You are about to drop the column `brower` on the `Visitor` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Visitor" DROP COLUMN "brower",
ADD COLUMN     "browser" TEXT;
