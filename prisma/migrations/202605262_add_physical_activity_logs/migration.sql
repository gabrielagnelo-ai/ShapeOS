CREATE TABLE IF NOT EXISTS "physical_activity_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "activity_key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "met" DOUBLE PRECISION NOT NULL,
  "duration_minutes" INTEGER NOT NULL,
  "calories_kcal" DOUBLE PRECISION NOT NULL,
  "intensity" TEXT,
  "note" TEXT,
  "source" TEXT NOT NULL DEFAULT 'manual_met',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "physical_activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "physical_activity_logs_user_id_date_idx" ON "physical_activity_logs"("user_id", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'physical_activity_logs_user_id_fkey'
  ) THEN
    ALTER TABLE "physical_activity_logs"
    ADD CONSTRAINT "physical_activity_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
