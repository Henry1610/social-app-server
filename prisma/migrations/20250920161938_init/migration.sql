-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "public"."ReactionType" AS ENUM ('LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY');

-- CreateEnum
CREATE TYPE "public"."PrivacyOption" AS ENUM ('everyone', 'followers', 'nobody');

-- CreateEnum
CREATE TYPE "public"."TargetType" AS ENUM ('POST', 'COMMENT', 'STORY', 'MESSAGE', 'REEL');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('COMMENT', 'FOLLOW', 'MENTION', 'REPOST', 'REPLY', 'FOLLOW_REQUEST', 'REACTION');

-- CreateEnum
CREATE TYPE "public"."NotificationTargetType" AS ENUM ('POST', 'COMMENT', 'USER', 'STORY', 'MESSAGE');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(100),
    "bio" TEXT,
    "avatar_url" VARCHAR(255),
    "role" "public"."UserRole" NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_seen" TIMESTAMP(3),
    "is_online" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."otp_verifications" (
    "id" SERIAL NOT NULL,
    "phone" VARCHAR(15),
    "email" VARCHAR(100) NOT NULL,
    "otp" VARCHAR(10) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_privacy_settings" (
    "user_id" INTEGER NOT NULL,
    "who_can_message" "public"."PrivacyOption" NOT NULL DEFAULT 'everyone',
    "who_can_tag_me" "public"."PrivacyOption" NOT NULL DEFAULT 'everyone',
    "who_can_find_by_email" BOOLEAN NOT NULL DEFAULT true,
    "show_online_status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_privacy_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."refresh_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "refresh_token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_resets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "reset_token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."posts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."post_media" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "media_url" VARCHAR(500) NOT NULL,
    "media_type" VARCHAR(50) NOT NULL DEFAULT 'image',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."post_privacy_settings" (
    "post_id" INTEGER NOT NULL,
    "who_can_see" VARCHAR(20) NOT NULL DEFAULT 'public',
    "who_can_comment" VARCHAR(20) NOT NULL DEFAULT 'everyone',

    CONSTRAINT "post_privacy_settings_pkey" PRIMARY KEY ("post_id")
);

-- CreateTable
CREATE TABLE "public"."hashtags" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hashtags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."post_hashtags" (
    "post_id" INTEGER NOT NULL,
    "hashtag_id" INTEGER NOT NULL,

    CONSTRAINT "post_hashtags_pkey" PRIMARY KEY ("post_id","hashtag_id")
);

-- CreateTable
CREATE TABLE "public"."comments" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reactions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "target_type" "public"."TargetType" NOT NULL,
    "target_id" INTEGER NOT NULL,
    "reaction_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reaction_summaries" (
    "id" SERIAL NOT NULL,
    "target_type" "public"."TargetType" NOT NULL,
    "target_id" INTEGER NOT NULL,
    "reaction_type" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reaction_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reaction_configs" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reaction_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mentions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "post_id" INTEGER,
    "comment_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reposts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "post_id" INTEGER NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reposts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."saved_posts" (
    "user_id" INTEGER NOT NULL,
    "post_id" INTEGER NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_posts_pkey" PRIMARY KEY ("user_id","post_id")
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
    "template_id" INTEGER,
    "reaction_id" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_templates" (
    "id" SERIAL NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "targetType" "public"."NotificationTargetType",
    "template" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."follows" (
    "follower_id" INTEGER NOT NULL,
    "following_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id","following_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "public"."users"("username");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "public"."users"("role");

-- CreateIndex
CREATE INDEX "users_is_online_idx" ON "public"."users"("is_online");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "public"."users"("created_at");

-- CreateIndex
CREATE INDEX "users_last_seen_idx" ON "public"."users"("last_seen");

-- CreateIndex
CREATE INDEX "otp_verifications_email_idx" ON "public"."otp_verifications"("email");

-- CreateIndex
CREATE INDEX "otp_verifications_otp_idx" ON "public"."otp_verifications"("otp");

-- CreateIndex
CREATE INDEX "otp_verifications_expires_at_idx" ON "public"."otp_verifications"("expires_at");

-- CreateIndex
CREATE INDEX "user_privacy_settings_who_can_message_idx" ON "public"."user_privacy_settings"("who_can_message");

-- CreateIndex
CREATE INDEX "user_privacy_settings_who_can_tag_me_idx" ON "public"."user_privacy_settings"("who_can_tag_me");

-- CreateIndex
CREATE INDEX "user_privacy_settings_who_can_find_by_email_idx" ON "public"."user_privacy_settings"("who_can_find_by_email");

-- CreateIndex
CREATE INDEX "user_privacy_settings_show_online_status_idx" ON "public"."user_privacy_settings"("show_online_status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_refresh_token_key" ON "public"."refresh_tokens"("refresh_token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "public"."refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_refresh_token_idx" ON "public"."refresh_tokens"("refresh_token");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "public"."refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_revoked_idx" ON "public"."refresh_tokens"("revoked");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_revoked_idx" ON "public"."refresh_tokens"("user_id", "revoked");

-- CreateIndex
CREATE INDEX "password_resets_user_id_idx" ON "public"."password_resets"("user_id");

-- CreateIndex
CREATE INDEX "password_resets_reset_token_idx" ON "public"."password_resets"("reset_token");

-- CreateIndex
CREATE INDEX "password_resets_expires_at_idx" ON "public"."password_resets"("expires_at");

-- CreateIndex
CREATE INDEX "password_resets_used_idx" ON "public"."password_resets"("used");

-- CreateIndex
CREATE INDEX "password_resets_reset_token_used_expires_at_idx" ON "public"."password_resets"("reset_token", "used", "expires_at");

-- CreateIndex
CREATE INDEX "posts_user_id_idx" ON "public"."posts"("user_id");

-- CreateIndex
CREATE INDEX "posts_created_at_idx" ON "public"."posts"("created_at");

-- CreateIndex
CREATE INDEX "posts_deleted_at_idx" ON "public"."posts"("deleted_at");

-- CreateIndex
CREATE INDEX "post_media_post_id_idx" ON "public"."post_media"("post_id");

-- CreateIndex
CREATE INDEX "post_media_media_type_idx" ON "public"."post_media"("media_type");

-- CreateIndex
CREATE INDEX "post_privacy_settings_who_can_see_idx" ON "public"."post_privacy_settings"("who_can_see");

-- CreateIndex
CREATE INDEX "post_privacy_settings_who_can_comment_idx" ON "public"."post_privacy_settings"("who_can_comment");

-- CreateIndex
CREATE UNIQUE INDEX "hashtags_name_key" ON "public"."hashtags"("name");

-- CreateIndex
CREATE INDEX "hashtags_name_idx" ON "public"."hashtags"("name");

-- CreateIndex
CREATE INDEX "comments_post_id_idx" ON "public"."comments"("post_id");

-- CreateIndex
CREATE INDEX "comments_user_id_idx" ON "public"."comments"("user_id");

-- CreateIndex
CREATE INDEX "comments_parent_id_idx" ON "public"."comments"("parent_id");

-- CreateIndex
CREATE INDEX "comments_created_at_idx" ON "public"."comments"("created_at");

-- CreateIndex
CREATE INDEX "comments_deleted_at_idx" ON "public"."comments"("deleted_at");

-- CreateIndex
CREATE INDEX "reactions_target_type_target_id_idx" ON "public"."reactions"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "reactions_user_id_idx" ON "public"."reactions"("user_id");

-- CreateIndex
CREATE INDEX "reactions_reaction_type_idx" ON "public"."reactions"("reaction_type");

-- CreateIndex
CREATE INDEX "reactions_created_at_idx" ON "public"."reactions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_user_id_target_type_target_id_key" ON "public"."reactions"("user_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "reaction_summaries_target_type_target_id_idx" ON "public"."reaction_summaries"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "reaction_summaries_target_type_target_id_reaction_type_key" ON "public"."reaction_summaries"("target_type", "target_id", "reaction_type");

-- CreateIndex
CREATE UNIQUE INDEX "reaction_configs_type_key" ON "public"."reaction_configs"("type");

-- CreateIndex
CREATE INDEX "mentions_user_id_idx" ON "public"."mentions"("user_id");

-- CreateIndex
CREATE INDEX "mentions_post_id_idx" ON "public"."mentions"("post_id");

-- CreateIndex
CREATE INDEX "mentions_comment_id_idx" ON "public"."mentions"("comment_id");

-- CreateIndex
CREATE INDEX "reposts_user_id_idx" ON "public"."reposts"("user_id");

-- CreateIndex
CREATE INDEX "reposts_post_id_idx" ON "public"."reposts"("post_id");

-- CreateIndex
CREATE INDEX "reposts_created_at_idx" ON "public"."reposts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reposts_user_id_post_id_key" ON "public"."reposts"("user_id", "post_id");

-- CreateIndex
CREATE INDEX "saved_posts_user_id_idx" ON "public"."saved_posts"("user_id");

-- CreateIndex
CREATE INDEX "saved_posts_saved_at_idx" ON "public"."saved_posts"("saved_at");

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

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_type_key" ON "public"."notification_templates"("type");

-- CreateIndex
CREATE INDEX "notification_templates_type_idx" ON "public"."notification_templates"("type");

-- CreateIndex
CREATE INDEX "notification_templates_is_active_idx" ON "public"."notification_templates"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_type_targetType_key" ON "public"."notification_templates"("type", "targetType");

-- AddForeignKey
ALTER TABLE "public"."user_privacy_settings" ADD CONSTRAINT "user_privacy_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."posts" ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."post_media" ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."post_privacy_settings" ADD CONSTRAINT "post_privacy_settings_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."post_hashtags" ADD CONSTRAINT "post_hashtags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."post_hashtags" ADD CONSTRAINT "post_hashtags_hashtag_id_fkey" FOREIGN KEY ("hashtag_id") REFERENCES "public"."hashtags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reactions" ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reactions" ADD CONSTRAINT "reactions_reaction_type_fkey" FOREIGN KEY ("reaction_type") REFERENCES "public"."reaction_configs"("type") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reaction_summaries" ADD CONSTRAINT "reaction_summaries_reaction_type_fkey" FOREIGN KEY ("reaction_type") REFERENCES "public"."reaction_configs"("type") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mentions" ADD CONSTRAINT "mentions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mentions" ADD CONSTRAINT "mentions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mentions" ADD CONSTRAINT "mentions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reposts" ADD CONSTRAINT "reposts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reposts" ADD CONSTRAINT "reposts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_posts" ADD CONSTRAINT "saved_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_posts" ADD CONSTRAINT "saved_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_reaction_id_fkey" FOREIGN KEY ("reaction_id") REFERENCES "public"."reaction_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
