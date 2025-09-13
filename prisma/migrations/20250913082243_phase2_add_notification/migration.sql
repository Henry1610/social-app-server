/*
  Warnings:

  - You are about to drop the `postHashtags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `postPrivacySetting` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('comment', 'follow', 'mention', 'repost', 'reaction');

-- CreateEnum
CREATE TYPE "public"."NotificationTargetType" AS ENUM ('post', 'comment', 'user', 'story', 'message');

-- DropForeignKey
ALTER TABLE "public"."postHashtags" DROP CONSTRAINT "postHashtags_hashtag_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."postHashtags" DROP CONSTRAINT "postHashtags_post_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."postPrivacySetting" DROP CONSTRAINT "postPrivacySetting_post_id_fkey";

-- DropTable
DROP TABLE "public"."postHashtags";

-- DropTable
DROP TABLE "public"."postPrivacySetting";

-- CreateTable
CREATE TABLE "public"."post_privacy_settings" (
    "post_id" INTEGER NOT NULL,
    "who_can_see" VARCHAR(20) NOT NULL DEFAULT 'public',
    "who_can_comment" VARCHAR(20) NOT NULL DEFAULT 'everyone',

    CONSTRAINT "post_privacy_settings_pkey" PRIMARY KEY ("post_id")
);

-- CreateTable
CREATE TABLE "public"."post_hashtags" (
    "post_id" INTEGER NOT NULL,
    "hashtag_id" INTEGER NOT NULL,

    CONSTRAINT "post_hashtags_pkey" PRIMARY KEY ("post_id","hashtag_id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "target_type" "public"."NotificationTargetType" NOT NULL,
    "target_id" INTEGER NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_privacy_settings_who_can_see_idx" ON "public"."post_privacy_settings"("who_can_see");

-- CreateIndex
CREATE INDEX "post_privacy_settings_who_can_comment_idx" ON "public"."post_privacy_settings"("who_can_comment");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "public"."notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_actor_id_idx" ON "public"."notifications"("actor_id");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "public"."notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_target_type_target_id_idx" ON "public"."notifications"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "public"."notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "public"."notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "public"."notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "public"."notifications"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "public"."post_privacy_settings" ADD CONSTRAINT "post_privacy_settings_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."post_hashtags" ADD CONSTRAINT "post_hashtags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."post_hashtags" ADD CONSTRAINT "post_hashtags_hashtag_id_fkey" FOREIGN KEY ("hashtag_id") REFERENCES "public"."hashtags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
