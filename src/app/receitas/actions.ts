"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { manualPlanCompatibilityIssue } from "@/lib/food-reliability";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfToday } from "@/lib/profile";
import { recipeIngredientInputs } from "@/lib/recipe-form";

export async function createRecipeAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const servings = Number(formData.get("servings") ?? 1);
  const instructions = String(formData.get("instructions") ?? "").trim();
  const items = await parseRecipeItems(formData, user.id);
  if (!name || name.length > 200 || !Number.isInteger(servings) || servings < 1 || servings > 100 || !items?.length) redirect("/receitas?recipeStatus=invalid-ingredients");

  await prisma.recipe.create({
    data: {
      userId: user.id,
      name,
      servings,
      instructions: instructions || null,
      items: { create: items },
    },
  });

  revalidateRecipePaths();
  redirect("/receitas?recipeStatus=recipe-created");
}

export async function updateRecipeAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const recipeId = String(formData.get("recipeId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const servings = Number(formData.get("servings") ?? 1);
  const instructions = String(formData.get("instructions") ?? "").trim();
  const items = await parseRecipeItems(formData, user.id);
  if (!recipeId || !name || name.length > 200 || !Number.isInteger(servings) || servings < 1 || servings > 100 || !items?.length) redirect("/receitas?recipeStatus=invalid-ingredients");

  const ownedRecipe = await prisma.recipe.findFirst({
    where: { id: recipeId, userId: user.id },
    select: { id: true },
  });
  if (!ownedRecipe) return;

  await prisma.$transaction([
    prisma.recipeItem.deleteMany({ where: { recipeId: ownedRecipe.id } }),
    prisma.recipe.update({
      where: { id: ownedRecipe.id },
      data: {
        name,
        servings,
        instructions: instructions || null,
        items: { create: items },
      },
    }),
  ]);

  revalidateRecipePaths();
  redirect("/receitas?recipeStatus=recipe-updated");
}

export async function deleteRecipeAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const recipeId = String(formData.get("recipeId") ?? "");
  if (!recipeId) return;

  await prisma.recipe.deleteMany({ where: { id: recipeId, userId: user.id } });
  revalidateRecipePaths();
}

export async function addRecipePortionToDiaryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const recipeId = String(formData.get("recipeId") ?? "");
  const portions = parsePositiveNumber(formData.get("portions"));
  if (!portions || portions > 100) redirect("/receitas?recipeStatus=invalid-ingredients");
  const mealName = String(formData.get("mealName") ?? "Refeicao");
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, OR: [{ userId: user.id }, { userId: null }] },
    include: { items: true },
  });
  if (!recipe) return;

  const date = startOfToday();
  const log = await prisma.foodLog.upsert({ where: { userId_date: { userId: user.id, date } }, create: { userId: user.id, date }, update: {}, select: { id: true } });

  const multiplier = portions / recipe.servings;
  await prisma.foodLogItem.createMany({
    data: recipe.items.map((item) => ({
      foodLogId: log.id,
      foodId: item.foodId,
      mealName,
      grams: Math.round(item.grams * multiplier * 10) / 10,
    })),
  });

  revalidateRecipePaths();
  revalidatePath("/diario");
  revalidatePath("/dashboard");
  redirect("/receitas?recipeStatus=recipe-logged");
}

export async function addRecipePortionToPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const recipeId = String(formData.get("recipeId") ?? "");
  const mealId = String(formData.get("mealId") ?? "");
  const portions = parsePositiveNumber(formData.get("portions"));
  if (!portions || portions > 100) redirect("/receitas?recipeStatus=invalid-ingredients");
  if (!recipeId || !mealId) return;

  const meal = await prisma.dietMeal.findFirst({
    where: { id: mealId, dietPlan: { userId: user.id, isActive: true } },
    select: { id: true },
  });
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, OR: [{ userId: user.id }, { userId: null }] },
    include: { items: { include: { food: true } } },
  });
  if (!meal || !recipe) return;

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");
  const issue = manualPlanCompatibilityIssue(recipe.items.map((item) => item.food.name), profile, formData.get("confirmSafetyReview") === "on");
  if (issue) redirect(`/receitas?recipeStatus=${issue}`);

  const multiplier = portions / recipe.servings;
  const recipeBatchId = randomUUID();
  await prisma.dietMealItem.createMany({
    data: recipe.items.map((item) => ({
      mealId,
      foodId: item.foodId,
      recipeId: recipe.id,
      recipeBatchId,
      recipePortions: portions,
      grams: Math.round(item.grams * multiplier * 10) / 10,
    })),
  });

  revalidateRecipePaths();
  revalidatePath("/dieta");
  revalidatePath("/dashboard");
  redirect("/receitas?recipeStatus=recipe-planned");
}

async function parseRecipeItems(formData: FormData, userId: string) {
  const rows = recipeIngredientInputs(formData);
  const enteredRows = Math.max(formData.getAll("foodId").length, formData.getAll("foodQuery").length, formData.getAll("grams").length);
  if (!rows.length || rows.length !== enteredRows || rows.some((row) => !row.foodId || row.grams > 10000)) return null;
  const items = await Promise.all(rows.map(async ({ foodId, grams }) => {
    const food = await prisma.food.findFirst({
      where: { id: foodId, OR: [{ createdByUserId: userId }, { createdByUserId: null }] },
      select: { id: true },
    });
    return food ? { foodId: food.id, grams } : null;
  }));
  return items.some((item) => item === null) ? null : items.filter((item): item is { foodId: string; grams: number } => item !== null);
}

function parsePositiveNumber(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function revalidateRecipePaths() {
  revalidatePath("/receitas");
}
