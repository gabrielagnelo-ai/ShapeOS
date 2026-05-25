ALTER TABLE "profiles"
ADD COLUMN IF NOT EXISTS "water_preference" TEXT NOT NULL DEFAULT 'medium';

CREATE TABLE IF NOT EXISTS "water_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "amount_ml" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "water_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "water_logs_user_id_date_idx" ON "water_logs"("user_id", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'water_logs_user_id_fkey'
  ) THEN
    ALTER TABLE "water_logs"
    ADD CONSTRAINT "water_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
