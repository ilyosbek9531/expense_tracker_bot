/*
  Warnings:

  - The `chatId` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "chatId",
ADD COLUMN     "chatId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "users_chatId_key" ON "users"("chatId");
