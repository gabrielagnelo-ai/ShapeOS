"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endOfToday, startOfToday } from "@/lib/profile";
import { isWholeChickenEgg, wholeEggPricePerKg } from "@/lib/shopping-list";

export async function createCustomFoodAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || "Personalizados";
  const nutritionBase = String(formData.get("nutritionBase") ?? "per100g");
  const servingGrams = parseOptionalNumber(formData.get("servingGrams"));
  const multiplier = nutritionBase === "perServing" && servingGrams && servingGrams > 0 ? 100 / servingGrams : 1;
  const protein = parseNumber(formData.get("proteinPer100g")) * multiplier;
  const carbs = parseNumber(formData.get("carbsPer100g")) * multiplier;
  const fat = parseNumber(formData.get("fatPer100g")) * multiplier;
  const kcalInput = parseOptionalNumber(formData.get("kcalPer100g"));
  const kcal = kcalInput != null ? kcalInput * multiplier : (protein * 4) + (carbs * 4) + (fat * 9);
  const fiber = parseOptionalNumber(formData.get("fiberPer100g"));
  const sodium = parseOptionalNumber(formData.get("sodiumPer100g"));
  const pricePerUnit = parseOptionalNumber(formData.get("pricePerUnit"));
  const pricePerKg = isWholeChickenEgg({ foodId: "", name }) && pricePerUnit != null
    ? wholeEggPricePerKg(pricePerUnit)
    : parseOptionalNumber(formData.get("pricePerKg"));
  if (!name || !Number.isFinite(kcal)) return;

  await prisma.food.create({
    data: {
      name,
      category,
      kcalPer100g: round(kcal),
      proteinPer100g: round(protein),
      carbsPer100g: round(carbs),
      fatPer100g: round(fat),
      fiberPer100g: fiber == null ? null : round(fiber * multiplier),
      sodiumPer100g: sodium == null ? null : round(sodium * multiplier),
      pricePerKg,
      source: "Usuário",
      createdByUserId: user.id,
    },
  });

  revalidatePath("/alimentos");
  revalidatePath("/dieta");
  revalidatePath("/diario");
  revalidatePath("/receitas");
}

export async function updateFoodLabelAndPriceAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const foodId = String(formData.get("foodId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!foodId || !name) return;

  const food = await prisma.food.findUnique({ where: { id: foodId }, select: { id: true, name: true } });
  if (!food) return;
  const pricePerUnit = parseOptionalNumber(formData.get("pricePerUnit"));
  const pricePerKg = isWholeChickenEgg({ foodId: food.id, name }) && pricePerUnit != null
    ? wholeEggPricePerKg(pricePerUnit)
    : parseOptionalNumber(formData.get("pricePerKg"));

  await prisma.food.update({
    where: { id: food.id },
    data: {
      name,
      pricePerKg,
    },
  });

  revalidatePath("/alimentos");
  revalidatePath("/dieta");
  revalidatePath("/diario");
  revalidatePath("/dashboard");
  revalidatePath("/receitas");
  revalidatePath("/relatorio-nutricionista");
}

export async function toggleFavoriteFoodAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const foodId = String(formData.get("foodId") ?? "");
  if (!foodId) return;
  const food = await prisma.food.findUnique({ where: { id: foodId }, select: { id: true } });
  if (!food) return;

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
  const food = await prisma.food.findUnique({ where: { id: foodId }, select: { id: true } });
  if (!food) return;

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
  const mealName = String(formData.get("mealName") ?? "Refeição");
  const grams = parseGrams(formData.get("grams"));
  if (!foodId || !grams) return;
  const food = await prisma.food.findUnique({ where: { id: foodId }, select: { id: true } });
  if (!food) return;

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
  const food = await prisma.food.findUnique({ where: { id: foodId }, select: { id: true } });
  if (!food) return;

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

function parseNumber(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
