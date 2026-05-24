"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endOfToday, startOfToday } from "@/lib/profile";

export async function createRecipeAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const name = String(formData.get("name") ?? "").trim();
  const servings = Number(formData.get("servings") ?? 1);
  const instructions = String(formData.get("instructions") ?? "").trim();
  const items = await parseRecipeItems(formData);
  if (!name || items.length === 0) return;

  await prisma.recipe.create({
    data: {
      userId: user.id,
      name,
      servings: Number.isFinite(servings) && servings > 0 ? servings : 1,
      instructions: instructions || null,
      items: {
        create: items,
      },
    },
  });

  revalidatePath("/receitas");
}

export async function deleteRecipeAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const recipeId = String(formData.get("recipeId") ?? "");
  if (!recipeId) return;

  await prisma.recipe.deleteMany({ where: { id: recipeId, userId: user.id } });
  revalidatePath("/receitas");
}

export async function addRecipePortionToDiaryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const recipeId = String(formData.get("recipeId") ?? "");
  const portions = parsePositiveNumber(formData.get("portions")) ?? 1;
  const mealName = String(formData.get("mealName") ?? "Refeição");
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, OR: [{ userId: user.id }, { userId: null }] },
    include: { items: true },
  });
  if (!recipe) return;

  let log = await prisma.foodLog.findFirst({
    where: { userId: user.id, date: { gte: startOfToday(), lte: endOfToday() } },
  });
  log ??= await prisma.foodLog.create({ data: { userId: user.id, date: startOfToday() } });

  const multiplier = portions / recipe.servings;
  await prisma.foodLogItem.createMany({
    data: recipe.items.map((item) => ({
      foodLogId: log.id,
      foodId: item.foodId,
      mealName,
      grams: Math.round(item.grams * multiplier * 10) / 10,
    })),
  });

  revalidatePath("/receitas");
  revalidatePath("/diario");
  revalidatePath("/dashboard");
}

export async function addRecipePortionToPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const recipeId = String(formData.get("recipeId") ?? "");
  const mealId = String(formData.get("mealId") ?? "");
  const portions = parsePositiveNumber(formData.get("portions")) ?? 1;
  if (!recipeId || !mealId) return;

  const meal = await prisma.dietMeal.findFirst({
    where: { id: mealId, dietPlan: { userId: user.id, isActive: true } },
    select: { id: true },
  });
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, OR: [{ userId: user.id }, { userId: null }] },
    include: { items: true },
  });
  if (!meal || !recipe) return;

  const multiplier = portions / recipe.servings;
  await prisma.dietMealItem.createMany({
    data: recipe.items.map((item) => ({
      mealId,
      foodId: item.foodId,
      grams: Math.round(item.grams * multiplier * 10) / 10,
    })),
  });

  revalidatePath("/receitas");
  revalidatePath("/dieta");
  revalidatePath("/dashboard");
}

async function parseRecipeItems(formData: FormData) {
  const items: Array<{ foodId: string; grams: number }> = [];

  for (let index = 0; index < 6; index += 1) {
    const foodId = String(formData.get(`foodId${index}`) ?? "");
    const foodQuery = String(formData.get(`foodQuery${index}`) ?? "").trim();
    const grams = parsePositiveNumber(formData.get(`grams${index}`));
    if ((!foodId && !foodQuery) || !grams) continue;

    const food = foodId
      ? await prisma.food.findUnique({ where: { id: foodId }, select: { id: true } })
      : await findFoodByQuery(foodQuery);
    if (food) items.push({ foodId: food.id, grams });
  }

  return items;
}

async function findFoodByQuery(query: string) {
  const normalized = query.trim();
  if (!normalized) return null;

  const exact = await prisma.food.findFirst({
    where: { name: { equals: normalized, mode: "insensitive" } },
    select: { id: true },
  });
  if (exact) return exact;

  return prisma.food.findFirst({
    where: { name: { contains: normalized, mode: "insensitive" } },
    orderBy: [{ source: "asc" }, { name: "asc" }],
    select: { id: true },
  });
}

function parsePositiveNumber(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
