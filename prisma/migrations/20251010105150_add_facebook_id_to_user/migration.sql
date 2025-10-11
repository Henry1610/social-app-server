/*
  Warnings:

  - A unique constraint covering the columns `[facebook_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "birthday" TIMESTAMP(3),
ADD COLUMN     "facebook_id" TEXT,
ADD COLUMN     "gender" VARCHAR(10),
ADD COLUMN     "provider" VARCHAR(50) DEFAULT 'local',
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_facebook_id_key" ON "public"."users"("facebook_id");
