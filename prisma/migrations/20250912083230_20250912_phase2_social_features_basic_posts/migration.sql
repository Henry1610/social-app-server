-- CreateTable
CREATE TABLE "public"."posts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."post_media" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "media_url" VARCHAR(500) NOT NULL,
    "media_type" VARCHAR(50) NOT NULL DEFAULT 'image',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."postPrivacySetting" (
    "post_id" INTEGER NOT NULL,
    "who_can_see" VARCHAR(20) NOT NULL DEFAULT 'public',
    "who_can_comment" VARCHAR(20) NOT NULL DEFAULT 'everyone',

    CONSTRAINT "postPrivacySetting_pkey" PRIMARY KEY ("post_id")
);

-- CreateTable
CREATE TABLE "public"."hashtags" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hashtags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."postHashtags" (
    "post_id" INTEGER NOT NULL,
    "hashtag_id" INTEGER NOT NULL,

    CONSTRAINT "postHashtags_pkey" PRIMARY KEY ("post_id","hashtag_id")
);

-- CreateTable
CREATE TABLE "public"."comments" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reactions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "target_type" VARCHAR(20) NOT NULL,
    "target_id" INTEGER NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'like',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mentions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "post_id" INTEGER,
    "comment_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reposts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "post_id" INTEGER NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reposts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."saved_posts" (
    "user_id" INTEGER NOT NULL,
    "post_id" INTEGER NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_posts_pkey" PRIMARY KEY ("user_id","post_id")
);

-- CreateIndex
CREATE INDEX "posts_user_id_idx" ON "public"."posts"("user_id");

-- CreateIndex
CREATE INDEX "posts_created_at_idx" ON "public"."posts"("created_at");

-- CreateIndex
CREATE INDEX "posts_deleted_at_idx" ON "public"."posts"("deleted_at");

-- CreateIndex
CREATE INDEX "post_media_post_id_idx" ON "public"."post_media"("post_id");

-- CreateIndex
CREATE INDEX "post_media_media_type_idx" ON "public"."post_media"("media_type");

-- CreateIndex
CREATE INDEX "postPrivacySetting_who_can_see_idx" ON "public"."postPrivacySetting"("who_can_see");

-- CreateIndex
CREATE INDEX "postPrivacySetting_who_can_comment_idx" ON "public"."postPrivacySetting"("who_can_comment");

-- CreateIndex
CREATE UNIQUE INDEX "hashtags_name_key" ON "public"."hashtags"("name");

-- CreateIndex
CREATE INDEX "hashtags_name_idx" ON "public"."hashtags"("name");

-- CreateIndex
CREATE INDEX "comments_post_id_idx" ON "public"."comments"("post_id");

-- CreateIndex
CREATE INDEX "comments_user_id_idx" ON "public"."comments"("user_id");

-- CreateIndex
CREATE INDEX "comments_parent_id_idx" ON "public"."comments"("parent_id");

-- CreateIndex
CREATE INDEX "comments_created_at_idx" ON "public"."comments"("created_at");

-- CreateIndex
CREATE INDEX "comments_deleted_at_idx" ON "public"."comments"("deleted_at");

-- CreateIndex
CREATE INDEX "reactions_target_type_target_id_idx" ON "public"."reactions"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "reactions_user_id_idx" ON "public"."reactions"("user_id");

-- CreateIndex
CREATE INDEX "reactions_type_idx" ON "public"."reactions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_user_id_target_type_target_id_key" ON "public"."reactions"("user_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "mentions_user_id_idx" ON "public"."mentions"("user_id");

-- CreateIndex
CREATE INDEX "mentions_post_id_idx" ON "public"."mentions"("post_id");

-- CreateIndex
CREATE INDEX "mentions_comment_id_idx" ON "public"."mentions"("comment_id");

-- CreateIndex
CREATE INDEX "reposts_user_id_idx" ON "public"."reposts"("user_id");

-- CreateIndex
CREATE INDEX "reposts_post_id_idx" ON "public"."reposts"("post_id");

-- CreateIndex
CREATE INDEX "reposts_created_at_idx" ON "public"."reposts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reposts_user_id_post_id_key" ON "public"."reposts"("user_id", "post_id");

-- CreateIndex
CREATE INDEX "saved_posts_user_id_idx" ON "public"."saved_posts"("user_id");

-- CreateIndex
CREATE INDEX "saved_posts_saved_at_idx" ON "public"."saved_posts"("saved_at");

-- AddForeignKey
ALTER TABLE "public"."posts" ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."post_media" ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."postPrivacySetting" ADD CONSTRAINT "postPrivacySetting_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."postHashtags" ADD CONSTRAINT "postHashtags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."postHashtags" ADD CONSTRAINT "postHashtags_hashtag_id_fkey" FOREIGN KEY ("hashtag_id") REFERENCES "public"."hashtags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reactions" ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mentions" ADD CONSTRAINT "mentions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mentions" ADD CONSTRAINT "mentions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mentions" ADD CONSTRAINT "mentions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reposts" ADD CONSTRAINT "reposts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reposts" ADD CONSTRAINT "reposts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_posts" ADD CONSTRAINT "saved_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_posts" ADD CONSTRAINT "saved_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
