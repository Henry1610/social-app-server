/*
  Warnings:

  - You are about to drop the `TypingIndicator` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `hashtags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mentions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `otp_verifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `password_resets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `post_hashtags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reaction_summaries` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."mentions" DROP CONSTRAINT "mentions_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."mentions" DROP CONSTRAINT "mentions_post_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."mentions" DROP CONSTRAINT "mentions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."password_resets" DROP CONSTRAINT "password_resets_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."post_hashtags" DROP CONSTRAINT "post_hashtags_hashtag_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."post_hashtags" DROP CONSTRAINT "post_hashtags_post_id_fkey";

-- DropTable
DROP TABLE "public"."TypingIndicator";

-- DropTable
DROP TABLE "public"."hashtags";

-- DropTable
DROP TABLE "public"."mentions";

-- DropTable
DROP TABLE "public"."otp_verifications";

-- DropTable
DROP TABLE "public"."password_resets";

-- DropTable
DROP TABLE "public"."post_hashtags";

-- DropTable
DROP TABLE "public"."reaction_summaries";
