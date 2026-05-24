ALTER TABLE "food"
ADD COLUMN IF NOT EXISTS "created_by_user_id" TEXT;

ALTER TABLE "food"
ADD CONSTRAINT "food_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "food_created_by_user_id_idx"
ON "food"("created_by_user_id");
