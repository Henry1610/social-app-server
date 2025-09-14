-- AddForeignKey
ALTER TABLE "public"."reactions" ADD CONSTRAINT "reaction_post_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reactions" ADD CONSTRAINT "reaction_comment_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
