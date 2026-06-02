-- Ensure one food diary per user/day after normalizing app-day timestamps.
CREATE UNIQUE INDEX IF NOT EXISTS "food_logs_user_id_date_key" ON "food_logs"("user_id", "date");
