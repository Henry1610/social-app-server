/*
  Warnings:

  - You are about to drop the column `who_can_find_by_email` on the `user_privacy_settings` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."FollowRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- DropIndex
DROP INDEX "public"."user_privacy_settings_who_can_find_by_email_idx";

-- AlterTable
ALTER TABLE "public"."user_privacy_settings" DROP COLUMN "who_can_find_by_email",
ADD COLUMN     "who_can_find_by_username" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "public"."FollowRequest" (
    "id" TEXT NOT NULL,
    "fromUserId" INTEGER NOT NULL,
    "toUserId" INTEGER NOT NULL,
    "status" "public"."FollowRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowRequest_toUserId_status_idx" ON "public"."FollowRequest"("toUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FollowRequest_fromUserId_toUserId_key" ON "public"."FollowRequest"("fromUserId", "toUserId");

-- CreateIndex
CREATE INDEX "user_privacy_settings_is_private_idx" ON "public"."user_privacy_settings"("is_private");

-- CreateIndex
CREATE INDEX "user_privacy_settings_who_can_find_by_username_idx" ON "public"."user_privacy_settings"("who_can_find_by_username");

-- AddForeignKey
ALTER TABLE "public"."FollowRequest" ADD CONSTRAINT "FollowRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FollowRequest" ADD CONSTRAINT "FollowRequest_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
