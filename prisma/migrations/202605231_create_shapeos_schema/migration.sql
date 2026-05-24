-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('FAT_LOSS', 'MAINTENANCE', 'MUSCLE_GAIN');

-- CreateEnum
CREATE TYPE "Experience" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "AppMode" AS ENUM ('GUIDED', 'ADVANCED');

-- CreateEnum
CREATE TYPE "InsightStatus" AS ENUM ('NEW', 'SEEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "InsightCategory" AS ENUM ('NUTRITION', 'WEIGHT', 'SLEEP', 'ADHERENCE', 'TRAINING');

-- CreateTable
CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "sex" "Sex" NOT NULL,
  "age" INTEGER NOT NULL,
  "height_cm" DOUBLE PRECISION NOT NULL,
  "weight_kg" DOUBLE PRECISION NOT NULL,
  "goal" "Goal" NOT NULL,
  "activity_factor" DOUBLE PRECISION NOT NULL,
  "experience" "Experience" NOT NULL,
  "restrictions" TEXT[],
  "allergies" TEXT[],
  "disliked_foods" TEXT[],
  "medical_conditions" TEXT[],
  "mode" "AppMode" NOT NULL,
  "target_calories" INTEGER,
  "protein_per_kg" DOUBLE PRECISION,
  "fat_per_kg" DOUBLE PRECISION,
  "carbs_per_kg" DOUBLE PRECISION,
  "meals_per_day" INTEGER NOT NULL DEFAULT 4,
  "fiber_target_g" DOUBLE PRECISION,
  "sodium_limit_mg" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "kcal_per_100g" DOUBLE PRECISION NOT NULL,
  "protein_per_100g" DOUBLE PRECISION NOT NULL,
  "carbs_per_100g" DOUBLE PRECISION NOT NULL,
  "fat_per_100g" DOUBLE PRECISION NOT NULL,
  "fiber_per_100g" DOUBLE PRECISION,
  "sodium_per_100g" DOUBLE PRECISION,
  "source" TEXT NOT NULL DEFAULT 'Seed ShapeOS',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_plans" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "goal" "Goal" NOT NULL,
  "target_calories" INTEGER NOT NULL,
  "target_protein_g" DOUBLE PRECISION NOT NULL,
  "target_carbs_g" DOUBLE PRECISION NOT NULL,
  "target_fat_g" DOUBLE PRECISION NOT NULL,
  "target_fiber_g" DOUBLE PRECISION,
  "sodium_limit_mg" DOUBLE PRECISION,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "diet_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_meals" (
  "id" TEXT NOT NULL,
  "diet_plan_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "macroShare" JSONB,
  CONSTRAINT "diet_meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_meal_items" (
  "id" TEXT NOT NULL,
  "meal_id" TEXT NOT NULL,
  "food_id" TEXT NOT NULL,
  "grams" DOUBLE PRECISION NOT NULL,
  "is_fixed" BOOLEAN NOT NULL DEFAULT false,
  "is_blocked" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "diet_meal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_log_items" (
  "id" TEXT NOT NULL,
  "food_log_id" TEXT NOT NULL,
  "food_id" TEXT NOT NULL,
  "meal_name" TEXT NOT NULL,
  "grams" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "food_log_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_checkins" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "week_start" TIMESTAMP(3) NOT NULL,
  "average_weight_kg" DOUBLE PRECISION NOT NULL,
  "waist_cm" DOUBLE PRECISION,
  "adherence_pct" DOUBLE PRECISION NOT NULL,
  "hunger" INTEGER NOT NULL,
  "energy" INTEGER NOT NULL,
  "sleep" INTEGER NOT NULL,
  "training_done" BOOLEAN NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "weekly_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_insights" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "priority" INTEGER NOT NULL,
  "status" "InsightStatus" NOT NULL DEFAULT 'NEW',
  "category" "InsightCategory" NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coach_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "name" TEXT NOT NULL,
  "servings" INTEGER NOT NULL,
  "instructions" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_items" (
  "id" TEXT NOT NULL,
  "recipe_id" TEXT NOT NULL,
  "food_id" TEXT NOT NULL,
  "grams" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "recipe_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");
CREATE INDEX "food_name_idx" ON "food"("name");
CREATE INDEX "food_logs_user_id_date_idx" ON "food_logs"("user_id", "date");
CREATE INDEX "weekly_checkins_user_id_week_start_idx" ON "weekly_checkins"("user_id", "week_start");
CREATE INDEX "coach_insights_user_id_status_priority_idx" ON "coach_insights"("user_id", "status", "priority");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diet_plans" ADD CONSTRAINT "diet_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diet_meals" ADD CONSTRAINT "diet_meals_diet_plan_id_fkey" FOREIGN KEY ("diet_plan_id") REFERENCES "diet_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diet_meal_items" ADD CONSTRAINT "diet_meal_items_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "diet_meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diet_meal_items" ADD CONSTRAINT "diet_meal_items_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_log_items" ADD CONSTRAINT "food_log_items_food_log_id_fkey" FOREIGN KEY ("food_log_id") REFERENCES "food_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_log_items" ADD CONSTRAINT "food_log_items_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "weekly_checkins" ADD CONSTRAINT "weekly_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coach_insights" ADD CONSTRAINT "coach_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
