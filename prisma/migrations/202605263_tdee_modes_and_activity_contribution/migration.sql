CREATE TYPE "TdeeCalculationMode" AS ENUM ('COEFFICIENT', 'ADDITIVE');
CREATE TYPE "TdeeConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

ALTER TABLE "profiles"
ADD COLUMN IF NOT EXISTS "tdee_calculation_mode" "TdeeCalculationMode" NOT NULL DEFAULT 'COEFFICIENT',
ADD COLUMN IF NOT EXISTS "tdee_confidence" "TdeeConfidence" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN IF NOT EXISTS "tdee_adjustment_kcal" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "physical_activity_logs"
ADD COLUMN IF NOT EXISTS "conservative_calories_kcal" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "confidence_factor" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "counts_toward_tdee" BOOLEAN NOT NULL DEFAULT true;

UPDATE "physical_activity_logs"
SET "counts_toward_tdee" = false
WHERE "activity_key" IN ('weight_training', 'heavy_lifting');
