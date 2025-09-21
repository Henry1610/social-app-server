/*
  Warnings:

  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_actor_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_reaction_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_template_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropTable
DROP TABLE "public"."notifications";

-- CreateTable
CREATE TABLE "public"."Notification" (
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

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_user_id_idx" ON "public"."Notification"("user_id");

-- CreateIndex
CREATE INDEX "Notification_actor_id_idx" ON "public"."Notification"("actor_id");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "public"."Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_target_type_target_id_idx" ON "public"."Notification"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "Notification_is_read_idx" ON "public"."Notification"("is_read");

-- CreateIndex
CREATE INDEX "Notification_created_at_idx" ON "public"."Notification"("created_at");

-- CreateIndex
CREATE INDEX "Notification_user_id_is_read_idx" ON "public"."Notification"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "Notification_user_id_created_at_idx" ON "public"."Notification"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "unique_like_follow" ON "public"."Notification"("user_id", "type", "target_type", "target_id");

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_reaction_id_fkey" FOREIGN KEY ("reaction_id") REFERENCES "public"."reaction_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
