-- Photo thumbnails: a small WebP stored next to the original. Old files have none (the original is served).
-- AlterTable
ALTER TABLE "file_objects" ADD COLUMN     "thumb_key" TEXT;

