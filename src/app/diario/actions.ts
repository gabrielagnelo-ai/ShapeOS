"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { findFoodByQuery } from "@/lib/food-search";
import { prisma } from "@/lib/prisma";
import { endOfToday, startOfToday } from "@/lib/profile";

export async function addFoodLogAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const foodId = String(formData.get("foodId") ?? "");
  const foodQuery = String(formData.get("foodQuery") ?? "").trim();
  const grams = Number(String(formData.get("grams") ?? "").replace(",", "."));
  const mealName = String(formData.get("mealName") ?? "Refeição");
  if ((!foodId && !foodQuery) || !Number.isFinite(grams) || grams <= 0) return;

  const food = foodId
    ? await prisma.food.findUnique({ where: { id: foodId }, select: { id: true } })
    : await findFoodByQuery(foodQuery);
  if (!food) return;

  let log = await prisma.foodLog.findFirst({
    where: { userId: user.id, date: { gte: startOfToday(), lte: endOfToday() } },
  });

  log ??= await prisma.foodLog.create({ data: { userId: user.id, date: startOfToday() } });

  await prisma.foodLogItem.create({ data: { foodLogId: log.id, foodId: food.id, mealName, grams } });
  revalidatePath("/diario");
  revalidatePath("/dashboard");
}

export async function deleteFoodLogItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.foodLogItem.deleteMany({
    where: { id: String(formData.get("itemId") ?? ""), foodLog: { userId: user.id } },
  });
  revalidatePath("/diario");
  revalidatePath("/dashboard");
}

export async function registerDietMealAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const mealId = String(formData.get("mealId") ?? "");
  if (!mealId) return;

  const meal = await prisma.dietMeal.findFirst({
    where: { id: mealId, dietPlan: { userId: user.id, isActive: true } },
    include: { items: { select: { foodId: true, grams: true } } },
  });
  if (!meal?.items.length) return;

  const date = startOfToday();
  const log = await prisma.foodLog.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date },
    update: {},
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.foodLogItem.deleteMany({
      where: { foodLogId: log.id, sourceDietMealId: meal.id },
    }),
    prisma.foodLogItem.createMany({
      data: meal.items.map((item) => ({
        foodLogId: log.id,
        foodId: item.foodId,
        mealName: meal.name,
        grams: item.grams,
        sourceDietMealId: meal.id,
      })),
    }),
  ]);

  revalidateDiaryData();
}

export async function unregisterDietMealAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const mealId = String(formData.get("mealId") ?? "");
  if (!mealId) return;

  const meal = await prisma.dietMeal.findFirst({
    where: { id: mealId, dietPlan: { userId: user.id } },
    select: { id: true },
  });
  if (!meal) return;

  await prisma.foodLogItem.deleteMany({
    where: {
      sourceDietMealId: meal.id,
      foodLog: { userId: user.id, date: { gte: startOfToday(), lte: endOfToday() } },
    },
  });

  revalidateDiaryData();
}

function revalidateDiaryData() {
  revalidatePath("/diario");
  revalidatePath("/dashboard");
  revalidatePath("/relatorio-nutricionista");
}
