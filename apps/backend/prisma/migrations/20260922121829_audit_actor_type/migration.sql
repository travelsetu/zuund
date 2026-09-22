-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "actor_type" "ActorType" NOT NULL DEFAULT 'ADMIN';

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");
