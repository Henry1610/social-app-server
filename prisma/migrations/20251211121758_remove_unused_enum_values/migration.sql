/*
  Warnings:

  - The values [STORY,REEL] on the enum `TargetType` will be removed. If these variants are still used in the database, this will fail.
  - The values [POST_SHARE] on the enum `MessageType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum TargetType: Remove STORY and REEL
BEGIN;
CREATE TYPE "public"."TargetType_new" AS ENUM ('POST', 'COMMENT', 'REPOST');
ALTER TABLE "public"."reactions" ALTER COLUMN "target_type" TYPE "public"."TargetType_new" USING ("target_type"::text::"public"."TargetType_new");
ALTER TYPE "public"."TargetType" RENAME TO "TargetType_old";
ALTER TYPE "public"."TargetType_new" RENAME TO "TargetType";
DROP TYPE "public"."TargetType_old";
COMMIT;

-- AlterEnum MessageType: Remove POST_SHARE
BEGIN;
CREATE TYPE "public"."MessageType_new" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'FILE');
ALTER TABLE "public"."messages" ALTER COLUMN "type" TYPE "public"."MessageType_new" USING ("type"::text::"public"."MessageType_new");
ALTER TYPE "public"."MessageType" RENAME TO "MessageType_old";
ALTER TYPE "public"."MessageType_new" RENAME TO "MessageType";
DROP TYPE "public"."MessageType_old";
COMMIT;

