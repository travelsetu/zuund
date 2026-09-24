-- A Buying Post's rounded location (device GPS, else IP) for nearby bands. Nullable: old posts have none.
-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('GPS', 'IP');

-- AlterTable
ALTER TABLE "buying_intents" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "location_source" "LocationSource",
ADD COLUMN     "longitude" DOUBLE PRECISION;

