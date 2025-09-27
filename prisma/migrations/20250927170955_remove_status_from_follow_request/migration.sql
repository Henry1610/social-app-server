/*
  Warnings:

  - You are about to drop the column `status` on the `follow_requests` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."follow_requests_toUserId_status_idx";

-- AlterTable
ALTER TABLE "public"."follow_requests" DROP COLUMN "status";

-- DropEnum
DROP TYPE "public"."FollowRequestStatus";

-- CreateIndex
CREATE INDEX "follow_requests_toUserId_idx" ON "public"."follow_requests"("toUserId");
