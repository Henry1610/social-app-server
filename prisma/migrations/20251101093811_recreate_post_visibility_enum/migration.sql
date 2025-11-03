/*
  Warnings:

  - The `whoCanComment` column on the `posts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `whoCanSee` column on the `posts` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."PostVisibility" AS ENUM ('public', 'private', 'follower');

-- CreateEnum
CREATE TYPE "public"."PostCommentPermission" AS ENUM ('everyone', 'no_one', 'follower');

-- AlterTable
ALTER TABLE "public"."posts" DROP COLUMN "whoCanComment",
ADD COLUMN     "whoCanComment" "public"."PostCommentPermission" NOT NULL DEFAULT 'everyone',
DROP COLUMN "whoCanSee",
ADD COLUMN     "whoCanSee" "public"."PostVisibility" NOT NULL DEFAULT 'public';
