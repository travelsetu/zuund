-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('CAR', 'SOLAR');

-- AlterTable
ALTER TABLE "cars" ADD COLUMN     "category" "ProductCategory" NOT NULL DEFAULT 'CAR',
ADD COLUMN     "segment" TEXT;

-- CreateIndex
CREATE INDEX "cars_category_status_idx" ON "cars"("category", "status");
