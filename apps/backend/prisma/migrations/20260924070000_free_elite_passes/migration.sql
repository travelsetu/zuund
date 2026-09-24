-- Free (15 days) and Elite (paid, 30 days) passes, connection history for the limits,
-- Elite direct-message credits and "active recently".
-- The plan defaults to ELITE so the API still running during the rolling reload keeps working.
-- CreateEnum
CREATE TYPE "PassPlan" AS ENUM ('FREE', 'ELITE');

-- AlterTable
ALTER TABLE "buying_passes" ADD COLUMN     "plan" "PassPlan" NOT NULL DEFAULT 'ELITE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_active_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "connection_acceptances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "other_user_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connection_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_message_credits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "buying_pass_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_message_credits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connection_acceptances_user_id_accepted_at_idx" ON "connection_acceptances"("user_id", "accepted_at");

-- CreateIndex
CREATE INDEX "direct_message_credits_user_id_idx" ON "direct_message_credits"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "direct_message_credits_buying_pass_id_recipient_id_key" ON "direct_message_credits"("buying_pass_id", "recipient_id");

-- CreateIndex
CREATE INDEX "users_last_active_at_idx" ON "users"("last_active_at");

-- AddForeignKey
ALTER TABLE "connection_acceptances" ADD CONSTRAINT "connection_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_acceptances" ADD CONSTRAINT "connection_acceptances_other_user_id_fkey" FOREIGN KEY ("other_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_message_credits" ADD CONSTRAINT "direct_message_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_message_credits" ADD CONSTRAINT "direct_message_credits_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_message_credits" ADD CONSTRAINT "direct_message_credits_buying_pass_id_fkey" FOREIGN KEY ("buying_pass_id") REFERENCES "buying_passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: ₹0 free-place passes are Free; paid ones stay Elite. Dates are kept.
UPDATE "buying_passes" SET "plan" = 'FREE' WHERE "amount" = 0;

-- Connections accepted before this migration, so the history is complete.
INSERT INTO "connection_acceptances" ("id", "user_id", "other_user_id", "connection_id", "accepted_at")
SELECT gen_random_uuid()::text, "requester_id", "recipient_id", "id", "accepted_at"
FROM "connections" WHERE "status" = 'ACCEPTED' AND "accepted_at" IS NOT NULL
UNION ALL
SELECT gen_random_uuid()::text, "recipient_id", "requester_id", "id", "accepted_at"
FROM "connections" WHERE "status" = 'ACCEPTED' AND "accepted_at" IS NOT NULL;
