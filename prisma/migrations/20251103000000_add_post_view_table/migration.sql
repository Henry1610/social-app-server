-- CreateTable
CREATE TABLE IF NOT EXISTS "post_views" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "post_views_post_id_idx" ON "post_views"("post_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "post_views_user_id_idx" ON "post_views"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "post_views_viewed_at_idx" ON "post_views"("viewed_at");

-- CreateUniqueConstraint
CREATE UNIQUE INDEX IF NOT EXISTS "post_views_postId_userId_key" ON "post_views"("post_id", "user_id");

-- AddForeignKey
ALTER TABLE "post_views" ADD CONSTRAINT "post_views_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_views" ADD CONSTRAINT "post_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

