/*
  Warnings:

  - You are about to drop the column `template_id` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the `notification_templates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `post_privacy_settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_template_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."post_privacy_settings" DROP CONSTRAINT "post_privacy_settings_post_id_fkey";

-- DropIndex
DROP INDEX "public"."hashtags_name_idx";

-- DropIndex
DROP INDEX "public"."reactions_user_id_idx";

-- DropIndex
DROP INDEX "public"."users_email_idx";

-- DropIndex
DROP INDEX "public"."users_username_idx";

-- AlterTable
ALTER TABLE "public"."notifications" DROP COLUMN "template_id";

-- AlterTable
ALTER TABLE "public"."posts" ADD COLUMN     "whoCanComment" TEXT NOT NULL DEFAULT 'everyone',
ADD COLUMN     "whoCanSee" TEXT NOT NULL DEFAULT 'public';

-- DropTable
DROP TABLE "public"."notification_templates";

-- DropTable
DROP TABLE "public"."post_privacy_settings";

-- CreateIndex
CREATE INDEX "comments_post_id_parent_id_idx" ON "public"."comments"("post_id", "parent_id");

-- CreateIndex
CREATE INDEX "comments_post_id_created_at_idx" ON "public"."comments"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "follows_following_id_created_at_idx" ON "public"."follows"("following_id", "created_at");

-- CreateIndex
CREATE INDEX "follows_follower_id_created_at_idx" ON "public"."follows"("follower_id", "created_at");
