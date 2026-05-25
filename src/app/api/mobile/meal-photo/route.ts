import { GoogleGenAI } from "@google/genai";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { getApiUser, unauthorized } from "@/lib/api-auth";
import { findFoodByQuery } from "@/lib/food-search";
import { nutrientsForGrams, sumNutrients } from "@/lib/nutrition";
import { endOfToday, startOfToday } from "@/lib/profile";

export const runtime = "nodejs";

const mealPhotoSchema = z.object({
  imageBase64: z.string().min(100).max(8_000_000),
  mimeType: z.string().regex(/^image\/(jpeg|jpg|png|webp)$/i).default("image/jpeg"),
  mealName: z.string().min(1).max(80).default("Refeicao por foto"),
  description: z.string().max(500).optional(),
  saveToDiary: z.boolean().default(false),
  saveAsRecipe: z.boolean().default(true),
});

type EstimatedItem = {
  foodName: string;
  grams: number;
  note?: string;
};

type MealPhotoResult = {
  title: string;
  confidence: "low" | "medium" | "high";
  items: EstimatedItem[];
  caution: string;
};

export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const { prisma } = await import("@/lib/prisma");
  const parsed = mealPhotoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const foods = await prisma.food.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    take: 220,
    select: {
      id: true,
      name: true,
      category: true,
      kcalPer100g: true,
      proteinPer100g: true,
      carbsPer100g: true,
      fatPer100g: true,
      fiberPer100g: true,
      sodiumPer100g: true,
    },
  });

  const cleanedBase64 = stripDataUrl(parsed.data.imageBase64);
  const result = process.env.GEMINI_API_KEY
    ? await analyzeMealPhoto({
        imageBase64: cleanedBase64,
        mimeType: parsed.data.mimeType,
        description: parsed.data.description,
        foods,
      })
    : fallbackPhotoResult(parsed.data.description);

  const resolvedItems = await resolveEstimatedItems(result.items);
  const totals = sumNutrients(resolvedItems.map((item) => ({ food: item.food, grams: item.grams })));

  const estimate = await prisma.mealPhotoEstimate.create({
    data: {
      userId: user.id,
      mealName: parsed.data.mealName,
      description: parsed.data.description,
      imageMimeType: parsed.data.mimeType,
      estimatedKcal: totals.kcal || null,
      estimatedProteinG: totals.proteinG || null,
      estimatedCarbsG: totals.carbsG || null,
      estimatedFatG: totals.fatG || null,
      confidence: result.confidence,
      rawResult: result,
    },
  });

  let recipeId: string | null = null;
  if (parsed.data.saveAsRecipe && resolvedItems.length) {
    const recipe = await prisma.recipe.create({
      data: {
        userId: user.id,
        name: result.title || "Refeicao estimada por foto",
        servings: 1,
        instructions: `${result.caution} Confira os ingredientes e as gramas antes de usar como meta fixa.`,
        items: {
          create: resolvedItems.map((item) => ({ foodId: item.food.id, grams: item.grams })),
        },
      },
      select: { id: true },
    });
    recipeId = recipe.id;
  }

  let diaryItems = 0;
  if (parsed.data.saveToDiary && resolvedItems.length) {
    let log = await prisma.foodLog.findFirst({
      where: { userId: user.id, date: { gte: startOfToday(), lte: endOfToday() } },
    });
    log ??= await prisma.foodLog.create({ data: { userId: user.id, date: startOfToday() } });

    await prisma.foodLogItem.createMany({
      data: resolvedItems.map((item) => ({
        foodLogId: log!.id,
        foodId: item.food.id,
        mealName: parsed.data.mealName,
        grams: item.grams,
      })),
    });
    diaryItems = resolvedItems.length;
  }

  return Response.json({
    estimateId: estimate.id,
    recipeId,
    diaryItems,
    confidence: result.confidence,
    caution: result.caution,
    totals,
    items: resolvedItems.map((item) => ({
      foodId: item.food.id,
      foodName: item.food.name,
      requestedName: item.requestedName,
      grams: item.grams,
      kcal: nutrientsForGrams(item.food, item.grams).kcal,
    })),
    unresolvedItems: result.items
      .filter((item) => !resolvedItems.some((resolved) => resolved.requestedName === item.foodName))
      .map((item) => item.foodName),
  });
}

async function analyzeMealPhoto(input: {
  imageBase64: string;
  mimeType: string;
  description?: string;
  foods: Array<{ name: string; category: string; kcalPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number }>;
}): Promise<MealPhotoResult> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          {
            text: [
              "Voce e o estimador visual de refeicoes do ShapeOS.",
              "Responda apenas JSON valido, sem markdown.",
              "Formato: {\"title\":\"nome curto\",\"confidence\":\"low|medium|high\",\"caution\":\"aviso curto\",\"items\":[{\"foodName\":\"nome exato\",\"grams\":100,\"note\":\"opcional\"}]}",
              "Use SOMENTE foodName exatamente igual a um alimento da lista.",
              "Se a foto estiver incerta, use confidence low e superestime levemente calorias.",
              "Nao diagnostique, nao prometa resultado e nao invente precisao.",
              `Descricao do usuario: ${input.description || "sem descricao"}`,
              `Alimentos disponiveis: ${JSON.stringify(input.foods.map((food) => ({
                name: food.name,
                category: food.category,
                kcal: food.kcalPer100g,
                protein: food.proteinPer100g,
                carbs: food.carbsPer100g,
                fat: food.fatPer100g,
              })))}`,
            ].join("\n"),
          },
          { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
        ],
      }],
    });

    return parsePhotoResult(response.text ?? "") ?? fallbackPhotoResult(input.description);
  } catch {
    return fallbackPhotoResult(input.description);
  }
}

async function resolveEstimatedItems(items: EstimatedItem[]) {
  const { prisma } = await import("@/lib/prisma");
  const resolved: Array<{
    requestedName: string;
    grams: number;
    food: {
      id: string;
      name: string;
      kcalPer100g: number;
      proteinPer100g: number;
      carbsPer100g: number;
      fatPer100g: number;
      fiberPer100g: number;
      sodiumPer100g: number;
    };
  }> = [];

  for (const item of items) {
    const grams = Number(item.grams);
    if (!Number.isFinite(grams) || grams <= 0) continue;
    const match = await findFoodByQuery(item.foodName);
    if (!match) continue;
    const food = await prisma.food.findUnique({ where: { id: match.id } });
    if (!food) continue;
    resolved.push({
      requestedName: item.foodName,
      grams: Math.round(grams * 10) / 10,
      food: {
        id: food.id,
        name: food.name,
        kcalPer100g: food.kcalPer100g,
        proteinPer100g: food.proteinPer100g,
        carbsPer100g: food.carbsPer100g,
        fatPer100g: food.fatPer100g,
        fiberPer100g: food.fiberPer100g ?? 0,
        sodiumPer100g: food.sodiumPer100g ?? 0,
      },
    });
  }

  return resolved;
}

function parsePhotoResult(text: string): MealPhotoResult | null {
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as MealPhotoResult;
    if (!parsed.title || !Array.isArray(parsed.items)) return null;
    return {
      title: parsed.title,
      confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "low",
      caution: parsed.caution || "Estimativa visual. Pese os alimentos para maior precisao.",
      items: parsed.items,
    };
  } catch {
    return null;
  }
}

function fallbackPhotoResult(description?: string): MealPhotoResult {
  return {
    title: description ? `Estimativa: ${description.slice(0, 60)}` : "Refeicao estimada por foto",
    confidence: "low",
    caution: "Estimativa visual. Fotos nao garantem porcao exata; confirme gramas quando possivel.",
    items: [
      { foodName: "Arroz branco cozido", grams: 150 },
      { foodName: "Peito de frango grelhado", grams: 150 },
      { foodName: "Brocolis cozido", grams: 80 },
    ],
  };
}

function stripDataUrl(value: string) {
  return value.includes(",") ? value.split(",").at(-1) ?? value : value;
}
