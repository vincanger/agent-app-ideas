/*
  Warnings:

  - You are about to drop the column `prefsKey` on the `Share` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[handle]` on the table `Share` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Share_handle_prefsKey_key";

-- AlterTable
ALTER TABLE "Share" DROP COLUMN "prefsKey";

-- CreateIndex
CREATE UNIQUE INDEX "Share_handle_key" ON "Share"("handle");
