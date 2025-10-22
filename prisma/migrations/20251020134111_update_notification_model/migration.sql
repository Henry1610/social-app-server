/*
  Warnings:

  - The values [STORY] on the enum `NotificationTargetType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `bio` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `birthday` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `refresh_tokens` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[user_id,type,target_type]` on the table `notifications` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."NotificationTargetType_new" AS ENUM ('POST', 'COMMENT', 'USER', 'MESSAGE');
ALTER TABLE "public"."notifications" ALTER COLUMN "target_type" TYPE "public"."NotificationTargetType_new" USING ("target_type"::text::"public"."NotificationTargetType_new");
ALTER TABLE "public"."notification_templates" ALTER COLUMN "targetType" TYPE "public"."NotificationTargetType_new" USING ("targetType"::text::"public"."NotificationTargetType_new");
ALTER TYPE "public"."NotificationTargetType" RENAME TO "NotificationTargetType_old";
ALTER TYPE "public"."NotificationTargetType_new" RENAME TO "NotificationTargetType";
DROP TYPE "public"."NotificationTargetType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "public"."NotificationType" ADD VALUE 'MESSAGE';

-- DropForeignKey
ALTER TABLE "public"."refresh_tokens" DROP CONSTRAINT "refresh_tokens_user_id_fkey";

-- AlterTable
ALTER TABLE "public"."notifications" ALTER COLUMN "target_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "bio",
DROP COLUMN "birthday",
DROP COLUMN "gender",
ALTER COLUMN "provider" SET DEFAULT 'email';

-- DropTable
DROP TABLE "public"."refresh_tokens";

-- CreateIndex
CREATE UNIQUE INDEX "unique_by_type" ON "public"."notifications"("user_id", "type", "target_type");

-- RenameIndex
ALTER INDEX "public"."unique_like_follow" RENAME TO "unique_by_target";
