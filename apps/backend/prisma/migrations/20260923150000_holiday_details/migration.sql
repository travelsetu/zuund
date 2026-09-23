-- Holiday Buying Posts: travel month and week, travellers, nights and hotel category.
CREATE TYPE "HotelCategory" AS ENUM ('BUDGET', 'THREE_STAR', 'FOUR_STAR', 'FIVE_STAR');

ALTER TABLE "buying_intents" ADD COLUMN "travel_month" VARCHAR(7),
ADD COLUMN "travel_week" INTEGER,
ADD COLUMN "adults" INTEGER,
ADD COLUMN "child_ages" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "nights" INTEGER,
ADD COLUMN "hotel_category" "HotelCategory";
