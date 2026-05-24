"use server";

import { GoogleGenAI } from "@google/genai";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics } from "@/lib/profile";

type AiMeal = {
  name: string;
  items: Array<{ foodName: string; grams: number }>;
};

export async function generateDietPlanAction() {
  const user = await getCurrentUser();
  if (!user) return;

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) return;

  const metrics = computeProfileMetrics(profile);
  const foods = await prisma.food.findMany({
    where: { name: { in: ["Arroz branco cozido", "Feijao carioca cozido", "Peito de frango grelhado", "Ovo de galinha inteiro", "Aveia em flocos", "Banana prata", "Tilapia grelhada", "Batata doce cozida"] } },
  });
  const byName = new Map(foods.map((food) => [food.name, food]));
  const meals = [
    { name: "Cafe da manha", items: [["Aveia em flocos", 60], ["Banana prata", 100], ["Ovo de galinha inteiro", 100]] },
    { name: "Almoco", items: [["Arroz branco cozido", 180], ["Feijao carioca cozido", 120], ["Peito de frango grelhado", 180]] },
    { name: "Pre-treino", items: [["Banana prata", 120], ["Aveia em flocos", 30]] },
    { name: "Jantar", items: [["Tilapia grelhada", 180], ["Batata doce cozida", 220]] },
  ];

  await prisma.dietPlan.updateMany({ where: { userId: user.id }, data: { isActive: false } });
  await prisma.dietPlan.create({
    data: {
      userId: user.id,
      name: `Plano ${new Date().toLocaleDateString("pt-BR")}`,
      goal: profile.goal,
      targetCalories: metrics.targets.calories,
      targetProteinG: metrics.targets.proteinG,
      targetCarbsG: metrics.targets.carbsG,
      targetFatG: metrics.targets.fatG,
      targetFiberG: metrics.targets.fiberG,
      sodiumLimitMg: metrics.targets.sodiumMg,
      isActive: true,
      meals: {
        create: meals.map((meal, index) => ({
          name: meal.name,
          order: index + 1,
          items: {
            create: meal.items.flatMap(([foodName, grams]) => {
              const food = byName.get(String(foodName));
              return food ? [{ foodId: food.id, grams: Number(grams) }] : [];
            }),
          },
        })),
      },
    },
  });

  revalidatePath("/dieta");
}

export async function generateAiDietPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) return;

  const metrics = computeProfileMetrics(profile);
  const monthlyBudget = Number(String(formData.get("monthlyBudget") ?? "").replace(",", "."));
  const foods = await prisma.food.findMany({ orderBy: { name: "asc" }, take: 80 });
  const foodNames = new Set(foods.map((food) => food.name));
  const byName = new Map(foods.map((food) => [food.name, food]));
  const meals = process.env.GEMINI_API_KEY
    ? await generateMealsWithGemini({
        foods: foods.map((food) => ({
          name: food.name,
          kcal: food.kcalPer100g,
          protein: food.proteinPer100g,
          carbs: food.carbsPer100g,
          fat: food.fatPer100g,
          pricePerKg: food.pricePerKg,
        })),
        targets: metrics.targets,
        dislikedFoods: profile.dislikedFoods,
        restrictions: profile.restrictions,
        dietPreference: profile.dietPreference ?? "balanced",
        monthlyBudget: Number.isFinite(monthlyBudget) && monthlyBudget > 0 ? monthlyBudget : undefined,
      })
    : null;

  const validMeals = (meals ?? fallbackMeals()).map((meal) => ({
    ...meal,
    items: meal.items.filter((item) => foodNames.has(item.foodName) && Number.isFinite(item.grams) && item.grams > 0),
  })).filter((meal) => meal.items.length > 0);

  await saveDietPlan({
    userId: user.id,
    profile,
    metrics,
    meals: validMeals.length ? validMeals : fallbackMeals(),
    byName,
    name: `Plano IA ${new Date().toLocaleDateString("pt-BR")}`,
  });

  revalidatePath("/dieta");
  revalidatePath("/dashboard");
}

export async function createManualDietPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) return;

  const metrics = computeProfileMetrics(profile);
  const name = String(formData.get("name") ?? "").trim() || `Plano manual ${new Date().toLocaleDateString("pt-BR")}`;
  const mealNames = ["Cafe da manha", "Almoco", "Pre-treino", "Jantar"];

  await prisma.dietPlan.updateMany({ where: { userId: user.id }, data: { isActive: false } });
  await prisma.dietPlan.create({
    data: {
      userId: user.id,
      name,
      goal: profile.goal,
      targetCalories: metrics.targets.calories,
      targetProteinG: metrics.targets.proteinG,
      targetCarbsG: metrics.targets.carbsG,
      targetFatG: metrics.targets.fatG,
      targetFiberG: metrics.targets.fiberG,
      sodiumLimitMg: metrics.targets.sodiumMg,
      isActive: true,
      meals: {
        create: mealNames.map((mealName, index) => ({
          name: mealName,
          order: index + 1,
        })),
      },
    },
  });

  revalidatePath("/dieta");
  revalidatePath("/dashboard");
}

export async function addManualDietItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const mealId = String(formData.get("mealId") ?? "");
  const foodId = String(formData.get("foodId") ?? "");
  const foodQuery = String(formData.get("foodQuery") ?? "").trim();
  const grams = Number(String(formData.get("grams") ?? "").replace(",", "."));
  if (!mealId || (!foodId && !foodQuery) || !Number.isFinite(grams) || grams <= 0) return;

  const meal = await prisma.dietMeal.findFirst({
    where: { id: mealId, dietPlan: { userId: user.id, isActive: true } },
    select: { id: true },
  });
  if (!meal) return;

  const food = foodId
    ? await prisma.food.findUnique({ where: { id: foodId }, select: { id: true } })
    : await findFoodByQuery(foodQuery);
  if (!food) return;

  await prisma.dietMealItem.create({
    data: {
      mealId,
      foodId: food.id,
      grams,
    },
  });

  revalidatePath("/dieta");
  revalidatePath("/dashboard");
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

export async function updateDietItemGramsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const itemId = String(formData.get("itemId") ?? "");
  const grams = Number(String(formData.get("grams") ?? "").replace(",", "."));
  if (!itemId || !Number.isFinite(grams) || grams <= 0) return;

  await prisma.dietMealItem.updateMany({
    where: { id: itemId, meal: { dietPlan: { userId: user.id } } },
    data: { grams },
  });

  revalidatePath("/dieta");
}

export async function removeDietItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;

  await prisma.dietMealItem.deleteMany({
    where: { id: itemId, meal: { dietPlan: { userId: user.id } } },
  });

  revalidatePath("/dieta");
  revalidatePath("/dashboard");
}

async function generateMealsWithGemini(input: {
  foods: Array<{ name: string; kcal: number; protein: number; carbs: number; fat: number; pricePerKg?: number | null }>;
  targets: ReturnType<typeof computeProfileMetrics>["targets"];
  dislikedFoods: string[];
  restrictions: string[];
  dietPreference: string;
  monthlyBudget?: number;
}): Promise<AiMeal[] | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{
          text: [
            "Monte uma dieta diaria em portugues do Brasil usando SOMENTE os alimentos da lista.",
            "Responda apenas JSON valido, sem markdown.",
            "Formato: {\"meals\":[{\"name\":\"Cafe da manha\",\"items\":[{\"foodName\":\"nome exato\",\"grams\":100}]}]}",
            "Use nomes de alimentos exatamente como aparecem na lista.",
            "Crie 4 refeicoes: Cafe da manha, Almoco, Pre-treino, Jantar.",
            "Meta: ficar proximo das calorias e macros. Carboidrato deve ser o restante das calorias depois de proteina e gordura.",
            `Calorias: ${input.targets.calories}`,
            `Proteina: ${input.targets.proteinG}g`,
            `Carboidrato: ${input.targets.carbsG}g`,
            `Gordura: ${input.targets.fatG}g`,
            "Tambem tente favorecer micronutrientes quando possivel: calcio, ferro, magnesio, potassio, zinco, vitamina C, vitamina D e B12.",
            `Evitar alimentos nao gostados: ${input.dislikedFoods.join(", ") || "nenhum"}`,
            `Restricoes: ${input.restrictions.join(", ") || "nenhuma"}`,
            `Preferencia alimentar: ${describeDietPreference(input.dietPreference)}`,
            input.monthlyBudget ? `Orcamento mensal aproximado: R$ ${input.monthlyBudget}. Priorize alimentos baratos e repetiveis. Considere cerca de R$ ${(input.monthlyBudget / 30).toFixed(2)} por dia.` : "Sem orcamento informado.",
            "Se houver pricePerKg nos alimentos, tente respeitar o orcamento. Se faltar preco, priorize alimentos tradicionalmente baratos no Brasil.",
            `Alimentos disponiveis: ${JSON.stringify(input.foods)}`,
          ].join("\n"),
        }],
      }],
    });
    const parsed = JSON.parse((response.text ?? "").replace(/^```json|```$/g, "").trim()) as { meals?: AiMeal[] };
    return Array.isArray(parsed.meals) ? parsed.meals : null;
  } catch {
    return null;
  }
}

function describeDietPreference(value: string) {
  const descriptions: Record<string, string> = {
    balanced: "equilibrar saciedade, prazer e aderencia",
    satiety: "priorizar saciedade com alimentos volumosos, ricos em proteina, fibra, legumes e frutas; evitar calorias liquidas e alimentos muito densos",
    pleasure: "incluir alimentos mais prazerosos em porcoes controladas sem ultrapassar macros; preservar aderencia psicologica",
    low_meal_volume: "preferir refeicoes menores e mais densas, sem volume excessivo; util para quem nao gosta de comer muito",
    simple_repetitive: "usar poucos alimentos, preparo simples e repeticao para facilitar rotina",
  };
  return descriptions[value] ?? descriptions.balanced;
}

async function saveDietPlan(input: {
  userId: string;
  profile: NonNullable<Awaited<ReturnType<typeof prisma.profile.findUnique>>>;
  metrics: ReturnType<typeof computeProfileMetrics>;
  meals: AiMeal[];
  byName: Map<string, { id: string }>;
  name: string;
}) {
  await prisma.dietPlan.updateMany({ where: { userId: input.userId }, data: { isActive: false } });
  await prisma.dietPlan.create({
    data: {
      userId: input.userId,
      name: input.name,
      goal: input.profile.goal,
      targetCalories: input.metrics.targets.calories,
      targetProteinG: input.metrics.targets.proteinG,
      targetCarbsG: input.metrics.targets.carbsG,
      targetFatG: input.metrics.targets.fatG,
      targetFiberG: input.metrics.targets.fiberG,
      sodiumLimitMg: input.metrics.targets.sodiumMg,
      isActive: true,
      meals: {
        create: input.meals.map((meal, index) => ({
          name: meal.name,
          order: index + 1,
          items: {
            create: meal.items.flatMap((item) => {
              const food = input.byName.get(item.foodName);
              return food ? [{ foodId: food.id, grams: Math.round(item.grams) }] : [];
            }),
          },
        })),
      },
    },
  });
}

function fallbackMeals(): AiMeal[] {
  return [
    { name: "Cafe da manha", items: [{ foodName: "Aveia em flocos", grams: 60 }, { foodName: "Banana prata", grams: 100 }, { foodName: "Ovo de galinha inteiro", grams: 100 }] },
    { name: "Almoco", items: [{ foodName: "Arroz branco cozido", grams: 180 }, { foodName: "Feijao carioca cozido", grams: 120 }, { foodName: "Peito de frango grelhado", grams: 180 }] },
    { name: "Pre-treino", items: [{ foodName: "Banana prata", grams: 120 }, { foodName: "Aveia em flocos", grams: 30 }] },
    { name: "Jantar", items: [{ foodName: "Tilapia grelhada", grams: 180 }, { foodName: "Batata doce cozida", grams: 220 }] },
  ];
}
