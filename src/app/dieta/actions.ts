"use server";

import { GoogleGenAI } from "@google/genai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { appDateParts } from "@/lib/date-time";
import { buildFluxaShoppingBudget, signFluxaPayload } from "@/lib/fluxa-integration";
import { baseMealNames, mealOrder, normalizeMealName } from "@/lib/meals";
import { prisma } from "@/lib/prisma";
import { computeCurrentProfileMetrics, computeProfileMetrics } from "@/lib/profile";
import { dietaryReviewIssue, foodAllowedForProfile, planCompatibilityIssue, manualPlanCompatibilityIssue, prepareCalorieMatchedPlan, starterMealDrafts, starterMealsForNames, type MealDraft } from "@/lib/food-reliability";

type AiMeal = MealDraft;

export async function syncShoppingBudgetToFluxaAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?erro=Sessão não encontrada. Entre novamente.");
  const period = String(formData.get("periodo") ?? "quinzenal");
  const returnPeriod = ["semanal", "quinzenal", "mensal"].includes(period) ? period : "quinzenal";
  const returnUrl = `/dieta?periodo=${returnPeriod}`;

  const plan = await prisma.dietPlan.findFirst({
    where: { userId: user.id, isActive: true },
    include: { meals: { include: { items: { include: { food: true } } } } },
  });
  if (!plan) redirect(`${returnUrl}&fluxa=no-plan`);

  const secret = process.env.FLUXA_INTEGRATION_SECRET;
  const baseUrl = process.env.FLUXA_API_URL ?? "https://fluxa-pi.vercel.app";
  if (!secret || secret.length < 32) redirect(`${returnUrl}&fluxa=config`);

  const budget = buildFluxaShoppingBudget(plan.meals.flatMap((meal) => meal.items), 30);
  if (budget.summary.estimatedTotal <= 0) redirect(`${returnUrl}&fluxa=no-prices`);
  if (budget.summary.missingPriceCount > 0 && formData.get("confirmPartialEstimate") !== "on") redirect(`${returnUrl}&fluxa=partial-prices`);

  const now = new Date();
  const currentDate = appDateParts(now);
  const body = JSON.stringify({
    version: 1,
    userEmail: user.email,
    month: currentDate.month,
    year: currentDate.year,
    generatedAt: now.toISOString(),
    plan: { id: plan.id, name: plan.name },
    ...budget,
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signFluxaPayload(secret, timestamp, body);
  let status = "error";

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/integrations/shapeos/shopping-list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ShapeOS-Timestamp": timestamp,
        "X-ShapeOS-Signature": signature,
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    status = response.ok ? "ok" : response.status === 404 ? "account" : "error";
  } catch {
    status = "offline";
  }

  redirect(`${returnUrl}&fluxa=${status}`);
}

export async function generateDietPlanAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");
  const { metrics } = await computeCurrentProfileMetrics(user.id, profile);
  const foods = await prisma.food.findMany({
    where: { OR: [{ createdByUserId: null }, { createdByUserId: user.id }], name: { in: starterMealDrafts.flatMap((meal) => meal.items.map((item) => item.foodName)) } },
  });
  const selectedMealNames = await getPreferredMealNames(user.id);
  const prepared = prepareCalorieMatchedPlan(starterMealsForNames(selectedMealNames), foods, profile, metrics.targets.calories);
  if (!prepared.meals) redirect(`/dieta?dietStatus=${prepared.issue}`);
  await saveDietPlan({ userId: user.id, profile, metrics, meals: prepared.meals, byName: new Map(foods.map((food) => [food.name, food])), name: `Plano ${new Date().toLocaleDateString("pt-BR")}` });
  revalidatePath("/dieta");
  revalidatePath("/dashboard");
  redirect("/dieta?dietStatus=plan-created");
}

export async function generateAiDietPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");
  const review = dietaryReviewIssue(profile);
  if (review) redirect(`/dieta?dietStatus=${review}`);
  if (!process.env.GEMINI_API_KEY) redirect("/dieta?dietStatus=ai-unavailable");
  const { metrics } = await computeCurrentProfileMetrics(user.id, profile);
  const monthlyBudget = Number(String(formData.get("monthlyBudget") ?? "").replace(",", "."));
  const selectedMealNames = await getPreferredMealNames(user.id);
  const candidates = await prisma.food.findMany({ where: { OR: [{ createdByUserId: null }, { createdByUserId: user.id }] }, orderBy: { name: "asc" } });
  const foods = candidates.filter((food) => foodAllowedForProfile(food.name, profile));
  if (!foods.length) redirect("/dieta?dietStatus=insufficient-foods");
  const meals = await generateMealsWithGemini({
    foods: foods.map((food) => ({ name: food.name, kcal: food.kcalPer100g, protein: food.proteinPer100g, carbs: food.carbsPer100g, fat: food.fatPer100g, pricePerKg: food.pricePerKg })),
    targets: metrics.targets, dislikedFoods: profile.dislikedFoods, restrictions: profile.restrictions,
    dietPreference: profile.dietPreference ?? "balanced", monthlyBudget: Number.isFinite(monthlyBudget) && monthlyBudget > 0 ? monthlyBudget : undefined, mealNames: selectedMealNames,
  });
  const allowedNames = new Set(foods.map((food) => food.name));
  if (!meals || meals.length !== selectedMealNames.length || new Set(meals.map((meal) => meal.name)).size !== selectedMealNames.length || meals.some((meal) => !selectedMealNames.includes(meal.name) || !Array.isArray(meal.items) || !meal.items.length || meal.items.some((item) => !allowedNames.has(item.foodName) || !Number.isFinite(item.grams) || item.grams <= 0))) redirect("/dieta?dietStatus=ai-unavailable");
  const prepared = prepareCalorieMatchedPlan(meals, foods, profile, metrics.targets.calories);
  if (!prepared.meals) redirect(`/dieta?dietStatus=${prepared.issue}`);
  await saveDietPlan({ userId: user.id, profile, metrics, meals: prepared.meals, byName: new Map(foods.map((food) => [food.name, food])), name: `Plano IA ${new Date().toLocaleDateString("pt-BR")}` });
  revalidatePath("/dieta");
  revalidatePath("/dashboard");
  redirect("/dieta?dietStatus=plan-created");
}

export async function createManualDietPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

  const review = dietaryReviewIssue(profile);
  if (review && formData.get("confirmSafetyReview") !== "on") redirect(`/dieta?dietStatus=${review}`);
  const { metrics } = await computeCurrentProfileMetrics(user.id, profile);
  const name = String(formData.get("name") ?? "").trim() || `Plano manual ${new Date().toLocaleDateString("pt-BR")}`;
  const manualMealNames = baseMealNames;

  await prisma.$transaction(async (tx) => {
    await tx.dietPlan.updateMany({ where: { userId: user.id }, data: { isActive: false } });
    await tx.dietPlan.create({
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
          create: manualMealNames.map((mealName, index) => ({
            name: mealName,
            order: index + 1,
          })),
        },
      },
    });

  });

  revalidatePath("/dieta");
  revalidatePath("/dashboard");
}

export async function setActiveDietPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const planId = String(formData.get("planId") ?? "");
  const plan = await prisma.dietPlan.findFirst({ where: { id: planId, userId: user.id }, include: { meals: { include: { items: { include: { food: true } } } } } });
  if (!plan) return;
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");
  const issue = manualPlanCompatibilityIssue(plan.meals.flatMap((meal) => meal.items.map((item) => item.food.name)), profile, formData.get("confirmSafetyReview") === "on");
  if (issue) redirect(`/dieta?dietStatus=${issue}`);

  await prisma.$transaction([
    prisma.dietPlan.updateMany({ where: { userId: user.id }, data: { isActive: false } }),
    prisma.dietPlan.update({ where: { id: plan.id }, data: { isActive: true } }),
  ]);

  revalidatePath("/dieta");
  revalidatePath("/dashboard");
}

export async function deleteDietPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const planId = String(formData.get("planId") ?? "");
  const plan = await prisma.dietPlan.findFirst({ where: { id: planId, userId: user.id }, select: { id: true, isActive: true } });
  if (!plan) return;

  const totalPlans = await prisma.dietPlan.count({ where: { userId: user.id } });
  if (totalPlans <= 1) return;

  await prisma.dietPlan.delete({ where: { id: plan.id } });


  revalidatePath("/dieta");
  revalidatePath("/dashboard");
}

export async function createProteinSwapDietPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const foodId = String(formData.get("foodId") ?? "");
  const variantName = String(formData.get("variantName") ?? "").trim();
  if (!foodId) redirect("/dieta?dietStatus=invalid-ingredients");

  const [activePlan, selectedFoodCandidate] = await Promise.all([
    prisma.dietPlan.findFirst({
      where: { userId: user.id, isActive: true },
      include: { meals: { include: { items: { include: { food: true } } }, orderBy: { order: "asc" } } },
    }),
    prisma.food.findFirst({ where: { id: foodId, OR: [{ createdByUserId: null }, { createdByUserId: user.id }] } }),
  ]);
  const selectedFood = selectedFoodCandidate;
  if (!activePlan || !selectedFood || selectedFood.proteinPer100g <= 0) redirect("/dieta?dietStatus=invalid-ingredients");

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");
  const names = activePlan.meals.flatMap((meal) => meal.items.map((item) => isPrimaryProteinFood(item.food) ? selectedFood.name : item.food.name));
  const issue = planCompatibilityIssue(names, profile);
  if (issue) redirect(`/dieta?dietStatus=${issue}`);
  if (activePlan.meals.some((meal) => meal.items.some((item) => isPrimaryProteinFood(item.food) && equivalentProteinGrams(item.grams, item.food.proteinPer100g, selectedFood.proteinPer100g) > 800))) redirect("/dieta?dietStatus=invalid-target");

  await prisma.$transaction(async (tx) => {
    await tx.dietPlan.updateMany({ where: { userId: user.id }, data: { isActive: false } });
    await tx.dietPlan.create({
      data: {
        userId: user.id,
        name: variantName || nextVariantName(activePlan.name, selectedFood.name),
        goal: activePlan.goal,
        targetCalories: activePlan.targetCalories,
        targetProteinG: activePlan.targetProteinG,
        targetCarbsG: activePlan.targetCarbsG,
        targetFatG: activePlan.targetFatG,
        targetFiberG: activePlan.targetFiberG,
        sodiumLimitMg: activePlan.sodiumLimitMg,
        isActive: true,
        meals: {
          create: activePlan.meals.map((meal) => ({
            name: meal.name,
            order: meal.order,
            macroShare: meal.macroShare ?? undefined,
            items: {
              create: meal.items.map((item) => {
                const shouldSwap = isPrimaryProteinFood(item.food);
                return {
                  foodId: shouldSwap ? selectedFood.id : item.foodId,
                  grams: shouldSwap ? equivalentProteinGrams(item.grams, item.food.proteinPer100g, selectedFood.proteinPer100g) : item.grams,
                  isFixed: item.isFixed,
                  isBlocked: item.isBlocked,
                };
              }),
            },
          })),
        },
      },
    });

  });

  revalidatePath("/dieta");
  revalidatePath("/dashboard");
}

export async function updateDietMealsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const selected = [...new Set(formData.getAll("mealNames").map((value) => normalizeMealName(String(value))).filter(Boolean))];
  if (!selected.length) return;

  const plan = await prisma.dietPlan.findFirst({
    where: { userId: user.id, isActive: true },
    include: { meals: { select: { id: true, name: true } } },
  });
  if (!plan) return;

  const byCanonical = new Map<string, typeof plan.meals>();
  plan.meals.forEach((meal) => {
    const canonical = normalizeMealName(meal.name);
    byCanonical.set(canonical, [...(byCanonical.get(canonical) ?? []), meal]);
  });

  for (const [canonical, meals] of byCanonical.entries()) {
    if (!selected.includes(canonical)) {
      await prisma.dietMeal.deleteMany({ where: { id: { in: meals.map((meal) => meal.id) } } });
      continue;
    }

    const [keeper, ...duplicates] = meals;
    await prisma.dietMeal.update({
      where: { id: keeper.id },
      data: { name: canonical, order: mealOrder(canonical) },
    });

    if (duplicates.length) {
      await prisma.dietMealItem.updateMany({
        where: { mealId: { in: duplicates.map((meal) => meal.id) } },
        data: { mealId: keeper.id },
      });
      await prisma.dietMeal.deleteMany({ where: { id: { in: duplicates.map((meal) => meal.id) } } });
    }
  }

  const existing = new Set([...byCanonical.keys()]);
  const missing = selected.filter((name) => !existing.has(name));
  if (missing.length) {
    await prisma.dietMeal.createMany({
      data: missing.map((name) => ({
        dietPlanId: plan.id,
        name,
        order: mealOrder(name),
      })),
    });
  }

  revalidatePath("/dieta");
  revalidatePath("/dashboard");
}

export async function addManualDietItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const mealId = String(formData.get("mealId") ?? "");
  const foodId = String(formData.get("foodId") ?? "");
  const grams = Number(String(formData.get("grams") ?? "").replace(",", "."));
  if (!mealId || !foodId || !Number.isFinite(grams) || grams <= 0 || grams > 10000) redirect("/dieta?dietStatus=invalid-ingredients");

  const meal = await prisma.dietMeal.findFirst({
    where: { id: mealId, dietPlan: { userId: user.id, isActive: true } },
    select: { id: true },
  });
  if (!meal) return;

  const food = await prisma.food.findFirst({ where: { id: foodId, OR: [{ createdByUserId: null }, { createdByUserId: user.id }] } });
  if (!food) redirect("/dieta?dietStatus=invalid-ingredients");
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");
  const issue = manualPlanCompatibilityIssue([food.name], profile, formData.get("confirmSafetyReview") === "on");
  if (issue) redirect(`/dieta?dietStatus=${issue}`);

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

export async function updateDietItemGramsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const itemId = String(formData.get("itemId") ?? "");
  const grams = Number(String(formData.get("grams") ?? "").replace(",", "."));
  if (!itemId || !Number.isFinite(grams) || grams <= 0 || grams > 10000) redirect("/dieta?dietStatus=invalid-ingredients");

  await prisma.dietMealItem.updateMany({
    where: { id: itemId, meal: { dietPlan: { userId: user.id } } },
    data: { grams },
  });

  revalidatePath("/dieta");
}

export async function removeDietItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;

  await prisma.dietMealItem.deleteMany({
    where: { id: itemId, meal: { dietPlan: { userId: user.id } } },
  });

  revalidatePath("/dieta");
  revalidatePath("/dashboard");
}

export async function removeRecipeFromDietMealAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const recipeBatchId = String(formData.get("recipeBatchId") ?? "");
  if (!recipeBatchId) return;

  await prisma.dietMealItem.deleteMany({
    where: { recipeBatchId, meal: { dietPlan: { userId: user.id } } },
  });

  revalidatePath("/dieta");
  revalidatePath("/dashboard");
  revalidatePath("/diario");
  revalidatePath("/relatorio-nutricionista");
}

async function generateMealsWithGemini(input: {
  foods: Array<{ name: string; kcal: number; protein: number; carbs: number; fat: number; pricePerKg?: number | null }>;
  targets: ReturnType<typeof computeProfileMetrics>["targets"];
  dislikedFoods: string[];
  restrictions: string[];
  dietPreference: string;
  monthlyBudget?: number;
  mealNames: string[];
}): Promise<AiMeal[] | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 20000 } });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{
          text: [
            "Monte uma dieta diária em português do Brasil usando SOMENTE os alimentos da lista.",
            "Responda apenas JSON válido, sem markdown.",
            "Formato: {\"meals\":[{\"name\":\"Café da manhã\",\"items\":[{\"foodName\":\"nome exato\",\"grams\":100}]}]}",
            "Use nomes de alimentos exatamente como aparecem na lista.",
            `Crie exatamente estas refeições, sem adicionar outras: ${input.mealNames.join(", ")}.`,
            "Meta: ficar próximo das calorias e macros. Carboidrato deve ser o restante das calorias depois de proteína e gordura.",
            `Calorias: ${input.targets.calories}`,
            `Proteína: ${input.targets.proteinG}g`,
            `Carboidrato: ${input.targets.carbsG}g`,
            `Gordura: ${input.targets.fatG}g`,
            "Também tente favorecer micronutrientes quando possível: cálcio, ferro, magnésio, potássio, zinco, vitamina C, vitamina D e B12.",
            `Evitar alimentos não gostados: ${input.dislikedFoods.join(", ") || "nenhum"}`,
            `Restrições: ${input.restrictions.join(", ") || "nenhuma"}`,
            `Preferência alimentar: ${describeDietPreference(input.dietPreference)}`,
            input.monthlyBudget ? `Orçamento mensal aproximado: R$ ${input.monthlyBudget}. Priorize alimentos baratos e repetíveis. Considere cerca de R$ ${(input.monthlyBudget / 30).toFixed(2)} por dia.` : "Sem orçamento informado.",
            "Se houver pricePerKg nos alimentos, tente respeitar o orçamento. Se faltar preço, priorize alimentos tradicionalmente baratos no Brasil.",
            `Alimentos disponíveis: ${JSON.stringify(input.foods)}`,
          ].join("\n"),
        }],
      }],
    });
    const parsed = JSON.parse((response.text ?? "").replace(/^```json|```$/g, "").trim()) as { meals?: AiMeal[] };
    return Array.isArray(parsed.meals) && parsed.meals.every((meal) => meal && typeof meal.name === "string" && Array.isArray(meal.items) && meal.items.every((item) => item && typeof item.foodName === "string" && typeof item.grams === "number")) ? parsed.meals : null;
  } catch {
    return null;
  }
}

function describeDietPreference(value: string) {
  const descriptions: Record<string, string> = {
    balanced: "equilibrar saciedade, prazer e aderência",
    satiety: "priorizar saciedade com alimentos volumosos, ricos em proteína, fibra, legumes e frutas; evitar calorias líquidas e alimentos muito densos",
    pleasure: "incluir alimentos mais prazerosos em porções controladas sem ultrapassar macros; preservar aderência psicológica",
    low_meal_volume: "preferir refeições menores e mais densas, sem volume excessivo; útil para quem não gosta de comer muito",
    simple_repetitive: "usar poucos alimentos, preparo simples e repetição para facilitar rotina",
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
  const issue = planCompatibilityIssue(input.meals.flatMap((meal) => meal.items.map((item) => item.foodName)), input.profile);
  if (issue) redirect(`/dieta?dietStatus=${issue}`);
  await prisma.$transaction(async (tx) => {
    await tx.dietPlan.updateMany({ where: { userId: input.userId }, data: { isActive: false } });
    await tx.dietPlan.create({
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
                return food ? [{ foodId: food.id, grams: item.grams }] : [];
              }),
            },
          })),
        },
      },
    });
  });
}

async function getPreferredMealNames(userId: string) {
  const activePlan = await prisma.dietPlan.findFirst({
    where: { userId, isActive: true },
    include: { meals: { orderBy: { order: "asc" }, select: { name: true } } },
  });

  const mealNames = activePlan?.meals.map((meal) => meal.name).filter(Boolean) ?? [];
  return mealNames.length ? [...new Set(mealNames.map(normalizeMealName))] : [...baseMealNames];
}

type ProteinFood = {
  name: string;
  category: string;
  kcalPer100g: number;
  proteinPer100g: number;
};

function isPrimaryProteinFood(food: ProteinFood) {
  const name = food.name.toLowerCase();
  const category = food.category.toLowerCase();
  const proteinCalories = food.proteinPer100g * 4;
  const proteinShare = food.kcalPer100g > 0 ? proteinCalories / food.kcalPer100g : 0;
  const excluded = ["arroz", "feijao", "feijão", "aveia", "banana", "batata", "mandioca", "abobora", "abóbora", "azeite", "abacate"];
  if (excluded.some((term) => name.includes(term))) return false;
  if (category.includes("leguminosa") || category.includes("cereal") || category.includes("fruta")) return false;
  return food.proteinPer100g >= 12 && proteinShare >= 0.35;
}

function equivalentProteinGrams(currentGrams: number, currentProteinPer100g: number, newProteinPer100g: number) {
  const proteinG = currentGrams * (currentProteinPer100g / 100);
  const grams = proteinG / (newProteinPer100g / 100);
  return Math.max(1, Math.round(grams));
}

function nextVariantName(currentName: string, proteinName: string) {
  return `${currentName.replace(/\s+-\s+variação.*$/i, "")} - variação ${proteinName}`;
}
