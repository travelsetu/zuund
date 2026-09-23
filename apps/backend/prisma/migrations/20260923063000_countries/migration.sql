-- AlterTable
ALTER TABLE "cities" ADD COLUMN     "country_code" VARCHAR(2) NOT NULL DEFAULT 'IN',
ADD COLUMN     "geoname_id" INTEGER,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "population" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "countries" (
    "code" VARCHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "continent" VARCHAR(2) NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "cities_geoname_id_key" ON "cities"("geoname_id");

-- CreateIndex
CREATE INDEX "cities_country_code_status_population_idx" ON "cities"("country_code", "status", "population");

-- Existing cities are all Indian; the seed fills in every other country.
INSERT INTO "countries" ("code", "name", "continent", "updated_at")
VALUES ('IN', 'India', 'AS', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

