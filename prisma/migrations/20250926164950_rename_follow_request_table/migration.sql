/*
  Warnings:

  - You are about to drop the `FollowRequest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."FollowRequest" DROP CONSTRAINT "FollowRequest_fromUserId_fkey";

-- DropForeignKey
ALTER TABLE "public"."FollowRequest" DROP CONSTRAINT "FollowRequest_toUserId_fkey";

-- DropTable
DROP TABLE "public"."FollowRequest";

-- CreateTable
CREATE TABLE "public"."follow_requests" (
    "id" TEXT NOT NULL,
    "fromUserId" INTEGER NOT NULL,
    "toUserId" INTEGER NOT NULL,
    "status" "public"."FollowRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follow_requests_toUserId_status_idx" ON "public"."follow_requests"("toUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "follow_requests_fromUserId_toUserId_key" ON "public"."follow_requests"("fromUserId", "toUserId");

-- AddForeignKey
ALTER TABLE "public"."follow_requests" ADD CONSTRAINT "follow_requests_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."follow_requests" ADD CONSTRAINT "follow_requests_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
