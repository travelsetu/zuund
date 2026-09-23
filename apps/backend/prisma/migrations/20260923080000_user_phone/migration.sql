-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "phone_verified_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

