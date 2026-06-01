CREATE TABLE "training_plans" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "source_file_name" TEXT,
  "source_mime_type" TEXT,
  "source_data" BYTEA,
  "raw_result" JSONB,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_days" (
  "id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "focus" TEXT,
  "order" INTEGER NOT NULL,
  "notes" TEXT,
  CONSTRAINT "training_days_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_exercises" (
  "id" TEXT NOT NULL,
  "day_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "muscle_group" TEXT,
  "sets" TEXT,
  "reps" TEXT,
  "rest_seconds" INTEGER,
  "load_instruction" TEXT,
  "notes" TEXT,
  "order" INTEGER NOT NULL,
  CONSTRAINT "training_exercises_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "training_plans_user_id_is_active_idx" ON "training_plans"("user_id", "is_active");
CREATE INDEX "training_days_plan_id_order_idx" ON "training_days"("plan_id", "order");
CREATE INDEX "training_exercises_day_id_order_idx" ON "training_exercises"("day_id", "order");

ALTER TABLE "training_plans"
ADD CONSTRAINT "training_plans_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "training_days"
ADD CONSTRAINT "training_days_plan_id_fkey"
FOREIGN KEY ("plan_id") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "training_exercises"
ADD CONSTRAINT "training_exercises_day_id_fkey"
FOREIGN KEY ("day_id") REFERENCES "training_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
