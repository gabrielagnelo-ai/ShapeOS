"use server";

import { GoogleGenAI } from "@google/genai";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { findFoodByQuery } from "@/lib/food-search";
import { prisma } from "@/lib/prisma";
import { endOfToday, startOfToday } from "@/lib/profile";

type AiRecipe = {
  name: string;
  servings: number;
  instructions?: string;
  items: Array<{ foodName: string; grams: number }>;
};

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
      items: { create: items },
    },
  });

  revalidatePath("/receitas");
}

export async function generateAiRecipeSuggestionAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const style = String(formData.get("style") ?? "satiety");
  const query = String(formData.get("query") ?? "").trim();
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  const foods = await recipeFoodContext(user.id);
  const recipe = process.env.GEMINI_API_KEY
    ? await generateRecipeWithGemini({
        mode: "suggestion",
        style,
        query,
        profileContext: {
          restrictions: profile?.restrictions ?? [],
          allergies: profile?.allergies ?? [],
          dislikedFoods: profile?.dislikedFoods ?? [],
          dietPreference: profile?.dietPreference ?? "balanced",
        },
        foods,
      })
    : fallbackRecipe(style, query);

  await saveAiRecipe(user.id, recipe, foods);
  revalidatePath("/receitas");
}

export async function estimateEatenRecipeAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const description = String(formData.get("description") ?? "").trim();
  if (!description) return;

  const foods = await recipeFoodContext(user.id);
  const recipe = process.env.GEMINI_API_KEY
    ? await generateRecipeWithGemini({
        mode: "estimate",
        style: "estimate",
        query: description,
        profileContext: {
          restrictions: [],
          allergies: [],
          dislikedFoods: [],
          dietPreference: "balanced",
        },
        foods,
      })
    : fallbackRecipe("estimate", description);

  await saveAiRecipe(user.id, recipe, foods);
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

async function recipeFoodContext(userId: string) {
  return prisma.food.findMany({
    where: {
      OR: [
        { source: { in: ["TACO 4a edicao", "Seed ShapeOS", "Usuário"] } },
        { createdByUserId: userId },
      ],
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    take: 160,
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
}): Promise<AiRecipe> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{
          text: [
            "Você é o motor de receitas do ShapeOS em português do Brasil.",
            "Responda apenas JSON válido, sem markdown.",
            "Formato: {\"name\":\"nome\",\"servings\":1,\"instructions\":\"modo de preparo curto\",\"items\":[{\"foodName\":\"nome exato\",\"grams\":100}]}",
            "Use SOMENTE foodName exatamente igual a um alimento da lista.",
            "Não invente alimentos fora da lista. Se faltar algo, use o substituto mais próximo.",
            "Não diagnostique, não prometa resultado, não use linguagem clínica.",
            input.mode === "suggestion"
              ? "Crie uma receita saudável, prática e realista baseada no estilo escolhido."
              : "Estime uma receita provável a partir da descrição do usuário. Seja conservador: melhor superestimar levemente do que subestimar calorias.",
            `Estilo: ${describeRecipeStyle(input.style)}`,
            `Pedido/descrição: ${input.query || "sem pedido específico"}`,
            `Preferência alimentar do perfil: ${input.profileContext.dietPreference}`,
            `Restrições: ${input.profileContext.restrictions.join(", ") || "nenhuma"}`,
            `Alergias: ${input.profileContext.allergies.join(", ") || "nenhuma"}`,
            `Não gosta: ${input.profileContext.dislikedFoods.join(", ") || "nenhum"}`,
            `Alimentos disponíveis: ${JSON.stringify(input.foods.map((food) => ({
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

    return parseAiRecipe(response.text ?? "") ?? fallbackRecipe(input.style, input.query);
  } catch {
    return fallbackRecipe(input.style, input.query);
  }
}

async function saveAiRecipe(userId: string, recipe: AiRecipe, foods: Awaited<ReturnType<typeof recipeFoodContext>>) {
  const byName = new Map(foods.map((food) => [food.name, food.id]));
  const items: Array<{ foodId: string; grams: number }> = [];

  for (const item of recipe.items) {
    const foodId = byName.get(item.foodName) ?? (await findFoodByQuery(item.foodName))?.id;
    const grams = Number(item.grams);
    if (foodId && Number.isFinite(grams) && grams > 0) {
      items.push({ foodId, grams: Math.round(grams * 10) / 10 });
    }
  }

  if (!items.length) return;

  await prisma.recipe.create({
    data: {
      userId,
      name: recipe.name || "Receita gerada pela IA",
      servings: Number.isFinite(recipe.servings) && recipe.servings > 0 ? Math.round(recipe.servings) : 1,
      instructions: recipe.instructions || "Receita gerada por IA. Confira ingredientes e modo de preparo antes de usar.",
      items: { create: items },
    },
  });
}

function parseAiRecipe(text: string): AiRecipe | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as AiRecipe;
    if (!parsed.name || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function fallbackRecipe(style: string, query: string): AiRecipe {
  const isSweet = style === "sweet" || /panqueca|doce|banana|chocolate|sobremesa/i.test(query);
  if (isSweet) {
    return {
      name: query ? `Estimativa: ${query}` : "Panqueca proteica de banana",
      servings: 1,
      instructions: "Misture os ingredientes, prepare em frigideira antiaderente e ajuste os toppings conforme sua meta.",
      items: [
        { foodName: "Banana prata", grams: 100 },
        { foodName: "Aveia em flocos", grams: 40 },
        { foodName: "Ovo de galinha inteiro", grams: 100 },
      ],
    };
  }

  return {
    name: query ? `Receita IA: ${query}` : "Bowl de frango com arroz e legumes",
    servings: 1,
    instructions: "Monte uma refeição simples com proteína, carboidrato e vegetais. Ajuste gramas conforme sua meta.",
    items: [
      { foodName: "Peito de frango grelhado", grams: 160 },
      { foodName: "Arroz branco cozido", grams: 160 },
      { foodName: "Brocolis cozido", grams: 100 },
    ],
  };
}

function describeRecipeStyle(style: string) {
  const labels: Record<string, string> = {
    satiety: "mais saciedade: volume, fibra, proteína e baixa densidade calórica",
    pleasure: "mais prazer: comida gostosa, ainda controlada em calorias",
    sweet: "doce saudável: sobremesa ou lanche doce com boa saciedade",
    high_protein: "alta proteína",
    low_calorie: "baixa caloria",
    simple: "simples, barato e repetível",
    estimate: "estimativa do que foi consumido",
  };
  return labels[style] ?? style;
}

function parsePositiveNumber(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
