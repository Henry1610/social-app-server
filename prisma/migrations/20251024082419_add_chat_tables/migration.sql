-- CreateEnum
CREATE TYPE "public"."ConversationType" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'FILE', 'POST_SHARE');

-- CreateEnum
CREATE TYPE "public"."DeliveryStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');

-- CreateEnum
CREATE TYPE "public"."MemberRole" AS ENUM ('ADMIN', 'MEMBER');

-- AlterEnum
ALTER TYPE "public"."NotificationTargetType" ADD VALUE 'CONVERSATION';

-- CreateTable
CREATE TABLE "public"."conversations" (
    "id" SERIAL NOT NULL,
    "type" "public"."ConversationType" NOT NULL DEFAULT 'DIRECT',
    "name" VARCHAR(100),
    "avatar_url" VARCHAR(255),
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_message_at" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conversation_members" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" "public"."MemberRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "last_read_at" TIMESTAMP(3),
    "is_muted" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "sender_id" INTEGER,
    "type" "public"."MessageType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT,
    "media_url" VARCHAR(500),
    "reply_to_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."message_edit_history" (
    "id" SERIAL NOT NULL,
    "message_id" INTEGER NOT NULL,
    "old_content" TEXT,
    "new_content" TEXT NOT NULL,
    "edited_by" INTEGER NOT NULL,
    "edited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_edit_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."message_states" (
    "id" SERIAL NOT NULL,
    "message_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "public"."DeliveryStatus" NOT NULL DEFAULT 'SENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."message_reactions" (
    "id" SERIAL NOT NULL,
    "message_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "emoji" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pinned_messages" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "message_id" INTEGER NOT NULL,
    "pinned_by_id" INTEGER NOT NULL,
    "pinned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pinned_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TypingIndicator" (
    "conversationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE INDEX "conversations_type_idx" ON "public"."conversations"("type");

-- CreateIndex
CREATE INDEX "conversations_last_message_at_idx" ON "public"."conversations"("last_message_at");

-- CreateIndex
CREATE INDEX "conversations_created_by_idx" ON "public"."conversations"("created_by");

-- CreateIndex
CREATE INDEX "conversation_members_user_id_idx" ON "public"."conversation_members"("user_id");

-- CreateIndex
CREATE INDEX "conversation_members_conversation_id_idx" ON "public"."conversation_members"("conversation_id");

-- CreateIndex
CREATE INDEX "conversation_members_last_read_at_idx" ON "public"."conversation_members"("last_read_at");

-- CreateIndex
CREATE INDEX "conversation_members_is_pinned_idx" ON "public"."conversation_members"("is_pinned");

-- CreateIndex
CREATE INDEX "conversation_members_user_id_is_pinned_last_read_at_idx" ON "public"."conversation_members"("user_id", "is_pinned", "last_read_at");

-- CreateIndex
CREATE INDEX "conversation_members_conversation_id_left_at_idx" ON "public"."conversation_members"("conversation_id", "left_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_members_conversation_id_user_id_key" ON "public"."conversation_members"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "public"."messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "public"."messages"("sender_id");

-- CreateIndex
CREATE INDEX "messages_reply_to_id_idx" ON "public"."messages"("reply_to_id");

-- CreateIndex
CREATE INDEX "messages_deleted_at_idx" ON "public"."messages"("deleted_at");

-- CreateIndex
CREATE INDEX "messages_type_idx" ON "public"."messages"("type");

-- CreateIndex
CREATE INDEX "messages_conversation_id_deleted_at_idx" ON "public"."messages"("conversation_id", "deleted_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_is_system_idx" ON "public"."messages"("conversation_id", "is_system");

-- CreateIndex
CREATE INDEX "message_edit_history_message_id_idx" ON "public"."message_edit_history"("message_id");

-- CreateIndex
CREATE INDEX "message_edit_history_edited_by_idx" ON "public"."message_edit_history"("edited_by");

-- CreateIndex
CREATE INDEX "message_edit_history_edited_at_idx" ON "public"."message_edit_history"("edited_at");

-- CreateIndex
CREATE INDEX "message_states_user_id_idx" ON "public"."message_states"("user_id");

-- CreateIndex
CREATE INDEX "message_states_status_idx" ON "public"."message_states"("status");

-- CreateIndex
CREATE UNIQUE INDEX "message_states_message_id_user_id_key" ON "public"."message_states"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "message_reactions_message_id_idx" ON "public"."message_reactions"("message_id");

-- CreateIndex
CREATE INDEX "message_reactions_user_id_idx" ON "public"."message_reactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_reactions_message_id_user_id_key" ON "public"."message_reactions"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "pinned_messages_conversation_id_pinned_at_idx" ON "public"."pinned_messages"("conversation_id", "pinned_at");

-- CreateIndex
CREATE INDEX "pinned_messages_pinned_by_id_idx" ON "public"."pinned_messages"("pinned_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "pinned_messages_conversation_id_message_id_key" ON "public"."pinned_messages"("conversation_id", "message_id");

-- CreateIndex
CREATE UNIQUE INDEX "TypingIndicator_conversationId_userId_key" ON "public"."TypingIndicator"("conversationId", "userId");

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversation_members" ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_edit_history" ADD CONSTRAINT "message_edit_history_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_edit_history" ADD CONSTRAINT "message_edit_history_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_states" ADD CONSTRAINT "message_states_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_states" ADD CONSTRAINT "message_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_reactions" ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_reactions" ADD CONSTRAINT "message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pinned_messages" ADD CONSTRAINT "pinned_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pinned_messages" ADD CONSTRAINT "pinned_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pinned_messages" ADD CONSTRAINT "pinned_messages_pinned_by_id_fkey" FOREIGN KEY ("pinned_by_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
