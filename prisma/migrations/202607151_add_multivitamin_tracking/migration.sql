ALTER TYPE "SupplementType" ADD VALUE IF NOT EXISTS 'MULTIVITAMIN';

ALTER TABLE "supplement_plans"
ADD COLUMN IF NOT EXISTS "micronutrients_per_dose" JSONB;
