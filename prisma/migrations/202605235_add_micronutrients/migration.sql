-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "calcium_target_mg" DOUBLE PRECISION;
ALTER TABLE "profiles" ADD COLUMN "iron_target_mg" DOUBLE PRECISION;
ALTER TABLE "profiles" ADD COLUMN "magnesium_target_mg" DOUBLE PRECISION;
ALTER TABLE "profiles" ADD COLUMN "potassium_target_mg" DOUBLE PRECISION;
ALTER TABLE "profiles" ADD COLUMN "zinc_target_mg" DOUBLE PRECISION;
ALTER TABLE "profiles" ADD COLUMN "vitamin_c_target_mg" DOUBLE PRECISION;
ALTER TABLE "profiles" ADD COLUMN "vitamin_d_target_mcg" DOUBLE PRECISION;
ALTER TABLE "profiles" ADD COLUMN "vitamin_b12_target_mcg" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "food" ADD COLUMN "calcium_per_100g" DOUBLE PRECISION;
ALTER TABLE "food" ADD COLUMN "iron_per_100g" DOUBLE PRECISION;
ALTER TABLE "food" ADD COLUMN "magnesium_per_100g" DOUBLE PRECISION;
ALTER TABLE "food" ADD COLUMN "potassium_per_100g" DOUBLE PRECISION;
ALTER TABLE "food" ADD COLUMN "zinc_per_100g" DOUBLE PRECISION;
ALTER TABLE "food" ADD COLUMN "vitamin_c_per_100g" DOUBLE PRECISION;
ALTER TABLE "food" ADD COLUMN "vitamin_d_per_100g" DOUBLE PRECISION;
ALTER TABLE "food" ADD COLUMN "vitamin_b12_per_100g" DOUBLE PRECISION;
