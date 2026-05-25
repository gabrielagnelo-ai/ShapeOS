CREATE TABLE IF NOT EXISTS "health_daily_summaries" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "steps" INTEGER,
  "active_energy_kcal" DOUBLE PRECISION,
  "resting_energy_kcal" DOUBLE PRECISION,
  "total_energy_kcal" DOUBLE PRECISION,
  "workout_minutes" INTEGER,
  "sleep_minutes" INTEGER,
  "resting_heart_rate_bpm" INTEGER,
  "average_heart_rate_bpm" INTEGER,
  "source" TEXT NOT NULL DEFAULT 'apple_health',
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "health_daily_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "health_daily_summaries_user_id_date_key" ON "health_daily_summaries"("user_id", "date");
CREATE INDEX IF NOT EXISTS "health_daily_summaries_user_id_date_idx" ON "health_daily_summaries"("user_id", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'health_daily_summaries_user_id_fkey'
  ) THEN
    ALTER TABLE "health_daily_summaries"
    ADD CONSTRAINT "health_daily_summaries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "meal_photo_estimates" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "meal_name" TEXT,
  "description" TEXT,
  "image_mime_type" TEXT,
  "estimated_kcal" DOUBLE PRECISION,
  "estimated_protein_g" DOUBLE PRECISION,
  "estimated_carbs_g" DOUBLE PRECISION,
  "estimated_fat_g" DOUBLE PRECISION,
  "confidence" TEXT,
  "raw_result" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "meal_photo_estimates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "meal_photo_estimates_user_id_created_at_idx" ON "meal_photo_estimates"("user_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meal_photo_estimates_user_id_fkey'
  ) THEN
    ALTER TABLE "meal_photo_estimates"
    ADD CONSTRAINT "meal_photo_estimates_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
