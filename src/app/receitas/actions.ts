"use server";

import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dietaryReviewIssue, foodAllowedForProfile, planCompatibilityIssue, manualPlanCompatibilityIssue, parseVerifiedRecipe, type AiRecipeDraft } from "@/lib/food-reliability";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfToday } from "@/lib/profile";
import { recipeIngredientInputs } from "@/lib/recipe-form";

type AiRecipe = AiRecipeDraft;

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

export async function generateAiRecipeSuggestionAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");
  const review = dietaryReviewIssue(profile);
  if (review) redirect(`/receitas?recipeStatus=${review}`);
  if (!process.env.GEMINI_API_KEY) redirect("/receitas?recipeStatus=ai-unavailable");
  const style = String(formData.get("style") ?? "satiety");
  const query = String(formData.get("query") ?? "").trim();
  const foods = (await recipeFoodContext(user.id)).filter((food) => foodAllowedForProfile(food.name, profile));
  const recipe = await generateRecipeWithGemini({ mode: "suggestion", style, query, profileContext: { restrictions: profile.restrictions, allergies: profile.allergies, dislikedFoods: profile.dislikedFoods, dietPreference: profile.dietPreference ?? "balanced" }, foods });
  if (!recipe) redirect("/receitas?recipeStatus=ai-unavailable");
  const issue = planCompatibilityIssue(recipe.items.map((item) => item.foodName), profile);
  if (issue) redirect(`/receitas?recipeStatus=${issue}`);
  await saveAiRecipe(user.id, recipe, foods);
  revalidateRecipePaths();
  redirect("/receitas?recipeStatus=recipe-created");
}

export async function estimateEatenRecipeAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const description = String(formData.get("description") ?? "").trim();
  if (!description || description.length > 3000) redirect("/receitas?recipeStatus=invalid-ingredients");
  if (!process.env.GEMINI_API_KEY) redirect("/receitas?recipeStatus=ai-unavailable");
  const foods = await recipeFoodContext(user.id);
  // Estimate a past meal as described; never substitute foods to fit a dietary preference.
  const recipe = await generateRecipeWithGemini({ mode: "estimate", style: "estimate", query: description,
    profileContext: { restrictions: [], allergies: [], dislikedFoods: [], dietPreference: "balanced" }, foods });
  if (!recipe) redirect("/receitas?recipeStatus=ai-unavailable");
  await saveAiRecipe(user.id, { ...recipe, name: `Estimativa: ${recipe.name}`.slice(0, 200), instructions: `Estimativa para revisão, não uma medição. ${recipe.instructions ?? "Confira ingredientes e porções antes de registrar."}` }, foods);
  revalidateRecipePaths();
  redirect("/receitas?recipeStatus=recipe-estimated");
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

async function recipeFoodContext(userId: string) {
  return prisma.food.findMany({
    where: { OR: [{ createdByUserId: userId }, { createdByUserId: null }] },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      kcalPer100g: true,
      proteinPer100g: true,
      carbsPer100g: true,
      fatPer100g: true,
      fiberPer100g: true,
    },
  });
}

async function generateRecipeWithGemini(input: {
  mode: "suggestion" | "estimate";
  style: string;
  query: string;
  profileContext: {
    restrictions: string[];
    allergies: string[];
    dislikedFoods: string[];
    dietPreference: string;
  };
  foods: Awaited<ReturnType<typeof recipeFoodContext>>;
}): Promise<AiRecipe | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, httpOptions: { timeout: 20000 } });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{
          text: [
            "Voce e o motor de receitas do ShapeOS em portugues do Brasil.",
            "Responda apenas JSON valido, sem markdown.",
            "Formato: {\"name\":\"nome\",\"servings\":1,\"instructions\":\"modo de preparo curto\",\"items\":[{\"foodName\":\"nome exato\",\"grams\":100}]}",
            "Use SOMENTE foodName exatamente igual a um alimento da lista.",
            "Nao invente alimentos fora da lista e nao substitua ingredientes relatados. Se nao conseguir identificar a refeicao, retorne null.",
            "Nao diagnostique, nao prometa resultado, nao use linguagem clinica.",
            input.mode === "suggestion"
              ? "Crie uma receita saudavel, pratica e realista baseada no estilo escolhido."
              : "Estime uma receita provavel a partir da descricao do usuario. Seja conservador: melhor superestimar levemente do que subestimar calorias.",
            `Estilo: ${describeRecipeStyle(input.style)}`,
            `Pedido/descricao: ${input.query || "sem pedido especifico"}`,
            `Preferencia alimentar do perfil: ${input.profileContext.dietPreference}`,
            `Restricoes: ${input.profileContext.restrictions.join(", ") || "nenhuma"}`,
            `Alergias: ${input.profileContext.allergies.join(", ") || "nenhuma"}`,
            `Nao gosta: ${input.profileContext.dislikedFoods.join(", ") || "nenhum"}`,
            `Alimentos disponiveis: ${JSON.stringify(input.foods.map((food) => ({
              name: food.name,
              category: food.category,
              kcal: food.kcalPer100g,
              protein: food.proteinPer100g,
              carbs: food.carbsPer100g,
              fat: food.fatPer100g,
              fiber: food.fiberPer100g,
            })))}`,
          ].join("\n"),
        }],
      }],
    });

    return parseVerifiedRecipe(response.text ?? "", new Set(input.foods.map((food) => food.name)));
  } catch {
    return null;
  }
}

async function saveAiRecipe(userId: string, recipe: AiRecipe, foods: Awaited<ReturnType<typeof recipeFoodContext>>) {
  const byName = new Map(foods.map((food) => [food.name, food.id]));
  // Validation is all-or-nothing: never silently replace or drop an AI ingredient.
  const validated = parseVerifiedRecipe(JSON.stringify(recipe), new Set(byName.keys()));
  if (!validated) redirect("/receitas?recipeStatus=invalid-ingredients");
  await prisma.recipe.create({ data: {
    userId, name: validated.name, servings: validated.servings,
    instructions: validated.instructions || "Confira os ingredientes e as porções antes de usar.",
    items: { create: validated.items.map((item) => ({ foodId: byName.get(item.foodName)!, grams: item.grams })) },
  } });
}

function describeRecipeStyle(style: string) {
  const labels: Record<string, string> = {
    satiety: "mais saciedade: volume, fibra, proteina e baixa densidade calorica",
    pleasure: "mais prazer: comida gostosa, ainda controlada em calorias",
    sweet: "doce saudavel: sobremesa ou lanche doce com boa saciedade",
    high_protein: "alta proteina",
    low_calorie: "baixa caloria",
    simple: "simples, barato e repetivel",
    estimate: "estimativa do que foi consumido",
  };
  return labels[style] ?? style;
}

function parsePositiveNumber(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function revalidateRecipePaths() {
  revalidatePath("/receitas");
}
