DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupplementType') THEN
    CREATE TYPE "SupplementType" AS ENUM ('CREATINE', 'BETA_ALANINE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupplementProtocol') THEN
    CREATE TYPE "SupplementProtocol" AS ENUM ('LOADING', 'STEADY');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "supplement_plans" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "SupplementType" NOT NULL,
  "protocol" "SupplementProtocol" NOT NULL DEFAULT 'STEADY',
  "name" TEXT NOT NULL,
  "daily_dose_g" DOUBLE PRECISION NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "supplement_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "supplement_plans_user_id_is_active_idx" ON "supplement_plans"("user_id", "is_active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supplement_plans_user_id_fkey'
  ) THEN
    ALTER TABLE "supplement_plans"
    ADD CONSTRAINT "supplement_plans_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "supplement_logs" (
  "id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "dose_g" DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supplement_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "supplement_logs_plan_id_date_key" ON "supplement_logs"("plan_id", "date");
CREATE INDEX IF NOT EXISTS "supplement_logs_plan_id_date_idx" ON "supplement_logs"("plan_id", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supplement_logs_plan_id_fkey'
  ) THEN
    ALTER TABLE "supplement_logs"
    ADD CONSTRAINT "supplement_logs_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "supplement_plans"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
