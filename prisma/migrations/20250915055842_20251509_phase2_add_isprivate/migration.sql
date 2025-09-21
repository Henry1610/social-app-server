/*
  Warnings:

  - You are about to drop the column `who_can_find_by_email` on the `user_privacy_settings` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."user_privacy_settings_who_can_find_by_email_idx";

-- AlterTable
ALTER TABLE "public"."user_privacy_settings" DROP COLUMN "who_can_find_by_email",
ADD COLUMN     "is_private" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "who_can_find_by_username" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "user_privacy_settings_is_private_idx" ON "public"."user_privacy_settings"("is_private");

-- CreateIndex
CREATE INDEX "user_privacy_settings_who_can_find_by_username_idx" ON "public"."user_privacy_settings"("who_can_find_by_username");
