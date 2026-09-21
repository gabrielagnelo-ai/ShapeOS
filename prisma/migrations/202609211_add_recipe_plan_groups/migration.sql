ALTER TABLE "diet_meal_items"
ADD COLUMN "recipe_id" TEXT,
ADD COLUMN "recipe_batch_id" TEXT,
ADD COLUMN "recipe_portions" DOUBLE PRECISION;

CREATE INDEX "diet_meal_items_recipe_id_idx" ON "diet_meal_items"("recipe_id");
CREATE INDEX "diet_meal_items_recipe_batch_id_idx" ON "diet_meal_items"("recipe_batch_id");

ALTER TABLE "diet_meal_items"
ADD CONSTRAINT "diet_meal_items_recipe_id_fkey"
FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
