-- AlterTable
ALTER TABLE "public"."messages" ADD COLUMN     "file_size" INTEGER,
ADD COLUMN     "filename" VARCHAR(255),
ADD COLUMN     "media_type" VARCHAR(100);
