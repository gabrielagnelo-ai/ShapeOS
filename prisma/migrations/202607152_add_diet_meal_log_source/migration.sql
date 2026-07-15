ALTER TABLE "food_log_items"
ADD COLUMN IF NOT EXISTS "source_diet_meal_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'food_log_items_source_diet_meal_id_fkey'
      AND conrelid = 'food_log_items'::regclass
  ) THEN
    ALTER TABLE "food_log_items"
    ADD CONSTRAINT "food_log_items_source_diet_meal_id_fkey"
    FOREIGN KEY ("source_diet_meal_id") REFERENCES "diet_meals"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "food_log_items_food_log_id_source_diet_meal_id_idx"
ON "food_log_items"("food_log_id", "source_diet_meal_id");
