CREATE TABLE "training_exercise_logs" (
  "id" TEXT NOT NULL,
  "exercise_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "sets_done" INTEGER,
  "reps_done" TEXT,
  "load_kg" DOUBLE PRECISION,
  "rpe" DOUBLE PRECISION,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_exercise_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "training_exercise_logs_user_id_date_idx" ON "training_exercise_logs"("user_id", "date");
CREATE INDEX "training_exercise_logs_exercise_id_date_idx" ON "training_exercise_logs"("exercise_id", "date");

ALTER TABLE "training_exercise_logs"
ADD CONSTRAINT "training_exercise_logs_exercise_id_fkey"
FOREIGN KEY ("exercise_id") REFERENCES "training_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
