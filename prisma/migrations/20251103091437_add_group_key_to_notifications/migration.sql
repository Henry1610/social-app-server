/*
  Warnings:

  - You are about to drop the column `is_read` on the `notifications` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_id,type,target_type,target_id,group_key]` on the table `notifications` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."notifications_is_read_idx";

-- DropIndex
DROP INDEX "public"."notifications_target_type_target_id_idx";

-- DropIndex
DROP INDEX "public"."notifications_type_idx";

-- DropIndex
DROP INDEX "public"."notifications_user_id_created_at_idx";

-- DropIndex
DROP INDEX "public"."notifications_user_id_is_read_idx";

-- DropIndex
DROP INDEX "public"."unique_by_target";

-- DropIndex
DROP INDEX "public"."unique_by_type";

-- AlterTable
ALTER TABLE "public"."notifications" DROP COLUMN "is_read",
ADD COLUMN     "group_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "unique_notif_key" ON "public"."notifications"("user_id", "type", "target_type", "target_id", "group_key");
