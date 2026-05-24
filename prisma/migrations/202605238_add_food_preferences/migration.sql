-- CreateTable
CREATE TABLE "food_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "food_id" TEXT NOT NULL,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "food_preferences_user_id_food_id_key" ON "food_preferences"("user_id", "food_id");

-- CreateIndex
CREATE INDEX "food_preferences_user_id_is_favorite_idx" ON "food_preferences"("user_id", "is_favorite");

-- CreateIndex
CREATE INDEX "food_preferences_user_id_is_blocked_idx" ON "food_preferences"("user_id", "is_blocked");

-- AddForeignKey
ALTER TABLE "food_preferences" ADD CONSTRAINT "food_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_preferences" ADD CONSTRAINT "food_preferences_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "food"("id") ON DELETE CASCADE ON UPDATE CASCADE;
