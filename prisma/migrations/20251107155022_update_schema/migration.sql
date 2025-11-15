/*
  Warnings:

  - The values [MESSAGE] on the enum `TargetType` will be removed. If these variants are still used in the database, this will fail.
  - The `whoCanComment` column on the `posts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `whoCanSee` column on the `posts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `who_can_find_by_username` column on the `user_privacy_settings` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[repost_id,user_id]` on the table `post_views` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."TargetType_new" AS ENUM ('POST', 'COMMENT', 'STORY', 'REEL', 'REPOST');
ALTER TABLE "public"."reactions" ALTER COLUMN "target_type" TYPE "public"."TargetType_new" USING ("target_type"::text::"public"."TargetType_new");
ALTER TABLE "public"."reaction_summaries" ALTER COLUMN "target_type" TYPE "public"."TargetType_new" USING ("target_type"::text::"public"."TargetType_new");
ALTER TYPE "public"."TargetType" RENAME TO "TargetType_old";
ALTER TYPE "public"."TargetType_new" RENAME TO "TargetType";
DROP TYPE "public"."TargetType_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."comments" ADD COLUMN     "repost_id" INTEGER,
ALTER COLUMN "post_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."post_views" ADD COLUMN     "repost_id" INTEGER,
ALTER COLUMN "post_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."posts" DROP COLUMN "whoCanComment",
ADD COLUMN     "whoCanComment" "public"."PrivacyOption" NOT NULL DEFAULT 'everyone',
DROP COLUMN "whoCanSee",
ADD COLUMN     "whoCanSee" "public"."PrivacyOption" NOT NULL DEFAULT 'everyone';

-- AlterTable
ALTER TABLE "public"."user_privacy_settings" DROP COLUMN "who_can_find_by_username",
ADD COLUMN     "who_can_find_by_username" "public"."PrivacyOption" NOT NULL DEFAULT 'everyone';

-- DropEnum
DROP TYPE "public"."PostCommentPermission";

-- DropEnum
DROP TYPE "public"."PostVisibility";

-- CreateIndex
CREATE INDEX "comments_repost_id_parent_id_idx" ON "public"."comments"("repost_id", "parent_id");

-- CreateIndex
CREATE INDEX "comments_repost_id_created_at_idx" ON "public"."comments"("repost_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_repost_id_idx" ON "public"."comments"("repost_id");

-- CreateIndex
CREATE INDEX "post_views_repost_id_idx" ON "public"."post_views"("repost_id");

-- CreateIndex
CREATE UNIQUE INDEX "repostId_userId_unique" ON "public"."post_views"("repost_id", "user_id");

-- CreateIndex
CREATE INDEX "user_privacy_settings_who_can_find_by_username_idx" ON "public"."user_privacy_settings"("who_can_find_by_username");

-- AddForeignKey
ALTER TABLE "public"."post_views" ADD CONSTRAINT "post_views_repost_id_fkey" FOREIGN KEY ("repost_id") REFERENCES "public"."reposts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_repost_id_fkey" FOREIGN KEY ("repost_id") REFERENCES "public"."reposts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."post_views_postId_userId_key" RENAME TO "postId_userId_unique";
