-- AlterTable
ALTER TABLE "public"."messages" ADD COLUMN     "is_recalled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recalled_at" TIMESTAMP(3);
