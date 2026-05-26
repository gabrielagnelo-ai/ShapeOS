CREATE TABLE IF NOT EXISTS "supplement_usage_periods" (
  "id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3),
  "daily_dose_g" DOUBLE PRECISION NOT NULL,
  "adherence_pct" DOUBLE PRECISION NOT NULL DEFAULT 100,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supplement_usage_periods_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "supplement_usage_periods_plan_id_start_date_idx" ON "supplement_usage_periods"("plan_id", "start_date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supplement_usage_periods_plan_id_fkey'
  ) THEN
    ALTER TABLE "supplement_usage_periods"
    ADD CONSTRAINT "supplement_usage_periods_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "supplement_plans"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
