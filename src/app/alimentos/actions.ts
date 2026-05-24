"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endOfToday, startOfToday } from "@/lib/profile";

export async function toggleFavoriteFoodAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const foodId = String(formData.get("foodId") ?? "");
  if (!foodId) return;

  const existing = await prisma.foodPreference.findUnique({
    where: { userId_foodId: { userId: user.id, foodId } },
  });

  await prisma.foodPreference.upsert({
    where: { userId_foodId: { userId: user.id, foodId } },
    create: { userId: user.id, foodId, isFavorite: true },
    update: { isFavorite: !existing?.isFavorite },
  });

  revalidatePath("/alimentos");
}

export async function toggleBlockedFoodAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const foodId = String(formData.get("foodId") ?? "");
  if (!foodId) return;

  const existing = await prisma.foodPreference.findUnique({
    where: { userId_foodId: { userId: user.id, foodId } },
  });

  await prisma.foodPreference.upsert({
    where: { userId_foodId: { userId: user.id, foodId } },
    create: { userId: user.id, foodId, isBlocked: true },
    update: { isBlocked: !existing?.isBlocked },
  });

  revalidatePath("/alimentos");
}

export async function addFoodFromLibraryToDiaryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const foodId = String(formData.get("foodId") ?? "");
  const mealName = String(formData.get("mealName") ?? "Refeicao");
  const grams = parseGrams(formData.get("grams"));
  if (!foodId || !grams) return;

  let log = await prisma.foodLog.findFirst({
    where: { userId: user.id, date: { gte: startOfToday(), lte: endOfToday() } },
  });

  log ??= await prisma.foodLog.create({ data: { userId: user.id, date: startOfToday() } });

  await prisma.foodLogItem.create({ data: { foodLogId: log.id, foodId, mealName, grams } });
  revalidatePath("/alimentos");
  revalidatePath("/diario");
  revalidatePath("/dashboard");
}

export async function addFoodFromLibraryToPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const foodId = String(formData.get("foodId") ?? "");
  const mealId = String(formData.get("mealId") ?? "");
  const grams = parseGrams(formData.get("grams"));
  if (!foodId || !mealId || !grams) return;

  const meal = await prisma.dietMeal.findFirst({
    where: { id: mealId, dietPlan: { userId: user.id, isActive: true } },
    select: { id: true },
  });
  if (!meal) return;

  await prisma.dietMealItem.create({ data: { mealId, foodId, grams } });
  revalidatePath("/alimentos");
  revalidatePath("/dieta");
  revalidatePath("/dashboard");
}

function parseGrams(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
