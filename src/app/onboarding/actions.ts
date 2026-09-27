"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createBodyCompositionSnapshot } from "@/lib/body-composition";
import { prisma } from "@/lib/prisma";
import { activityFactors, advancedMacroTargets, guidedMacroTargets, calculateBmr, calculateTdee } from "@/lib/nutrition";
import { parseOnboardingInput } from "@/lib/onboarding-input";
import { planCompatibilityIssue, prepareCalorieMatchedPlan, starterMealDrafts, type DietaryProfile } from "@/lib/food-reliability";

const sexMap = {
  male: "MALE",
  female: "FEMALE",
} as const;

const goalMap = {
  fat_loss: "FAT_LOSS",
  maintenance: "MAINTENANCE",
  muscle_gain: "MUSCLE_GAIN",
} as const;

const experienceMap = {
  beginner: "BEGINNER",
  intermediate: "INTERMEDIATE",
  advanced: "ADVANCED",
} as const;

const modeMap = {
  guided: "GUIDED",
  advanced: "ADVANCED",
} as const;

export async function saveOnboardingAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = parseOnboardingInput(formData, user.name);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "dados");
    redirect(`/onboarding?onboardingError=invalid-input&field=${encodeURIComponent(field)}`);
  }
  const { sex, goal, activityLevel, experience, mode, age, heightCm, weightKg, neckCm, waistCm,
    manualActivityFactor, deficitKcal, proteinPerKg, fatPerKg, dietPreference, name } = parsed.data;
  const hipCm = parsed.data.hipCm ?? null;
  const dietaryProfile = {
    restrictions: splitList(String(formData.get("restrictions") ?? "")),
    allergies: splitList(String(formData.get("allergies") ?? "")),
    dislikedFoods: splitList(String(formData.get("dislikedFoods") ?? "")),
  };
  const activityFactor = mode === "advanced" && manualActivityFactor !== undefined ? manualActivityFactor : activityFactors[activityLevel];
  const bmr = calculateBmr({ sex, age, heightCm, weightKg });
  const tdee = calculateTdee(bmr, activityFactor);
  const calorieAdjustment = goal === "fat_loss" ? -deficitKcal : undefined;
  const targets =
    mode === "advanced"
      ? advancedMacroTargets({ calories: goal === "fat_loss" ? tdee - deficitKcal : goal === "muscle_gain" ? tdee + 300 : tdee, weightKg, proteinPerKg, fatPerKg, useRemainingCarbs: true, fiberG: 30, sodiumMg: 2300 })
      : guidedMacroTargets({ weightKg, tdee, goal, calorieAdjustment, proteinPerKg, fatPerKg, fiberG: 30, sodiumMg: 2300 });

  if (targets.calories < 1000 || targets.calories > 6000 || targets.proteinG * 4 + targets.fatG * 9 > targets.calories) {
    redirect("/onboarding?onboardingError=invalid-target");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      profile: {
        upsert: {
          create: {
            sex: sexMap[sex],
            age,
            heightCm,
            weightKg,
            neckCm,
            waistCm,
            hipCm,
            goal: goalMap[goal],
            activityFactor,
            experience: experienceMap[experience],
            restrictions: dietaryProfile.restrictions,
            allergies: dietaryProfile.allergies,
            dislikedFoods: dietaryProfile.dislikedFoods,
            medicalConditions: splitList(String(formData.get("medicalConditions") ?? "")),
            dietPreference,
            mode: modeMap[mode],
            targetCalories: targets.calories,
            calorieDeficitKcal: goal === "fat_loss" ? deficitKcal : null,
            proteinPerKg,
            fatPerKg,
            mealsPerDay: 4,
            fiberTargetG: targets.fiberG,
            sodiumLimitMg: targets.sodiumMg,
          },
          update: {
            sex: sexMap[sex],
            age,
            heightCm,
            weightKg,
            neckCm,
            waistCm,
            hipCm,
            goal: goalMap[goal],
            activityFactor,
            experience: experienceMap[experience],
            restrictions: dietaryProfile.restrictions,
            allergies: dietaryProfile.allergies,
            dislikedFoods: dietaryProfile.dislikedFoods,
            medicalConditions: splitList(String(formData.get("medicalConditions") ?? "")),
            dietPreference,
            mode: modeMap[mode],
            targetCalories: targets.calories,
            calorieDeficitKcal: goal === "fat_loss" ? deficitKcal : null,
            proteinPerKg,
            fatPerKg,
            fiberTargetG: targets.fiberG,
            sodiumLimitMg: targets.sodiumMg,
          },
        },
      },
    },
  });

  await createBodyCompositionSnapshot({
    userId: user.id,
    source: "onboarding",
    sex,
    heightCm,
    weightKg,
    neckCm,
    waistCm,
    hipCm,
  });

  const planIssue = await createStarterDietPlan({
    userId: user.id,
    goal: goalMap[goal],
    targets,
    dietaryProfile,
  });

  redirect(planIssue ? `/dieta?dietStatus=${planIssue}` : "/dashboard");
}

async function createStarterDietPlan(input: {
  userId: string;
  goal: (typeof goalMap)[keyof typeof goalMap];
  targets: ReturnType<typeof guidedMacroTargets>;
  dietaryProfile: DietaryProfile;
}): Promise<string | null> {
  const existing = await prisma.dietPlan.findFirst({
    where: { userId: input.userId, isActive: true },
    include: { meals: { include: { items: { include: { food: true } } } } },
  });
  if (existing) {
    const issue = planCompatibilityIssue(existing.meals.flatMap((meal) => meal.items.map((item) => item.food.name)), input.dietaryProfile);
    if (issue) await prisma.dietPlan.update({ where: { id: existing.id }, data: { isActive: false } });
    return issue;
  }
  const foods = await prisma.food.findMany({
    where: { createdByUserId: null, name: { in: starterMealDrafts.flatMap((meal) => meal.items.map((item) => item.foodName)) } },
    select: { id: true, name: true, kcalPer100g: true },
  });
  const prepared = prepareCalorieMatchedPlan(starterMealDrafts.filter((meal) => meal.name !== "Ceia"), foods, input.dietaryProfile, input.targets.calories);
  if (prepared.issue || !prepared.meals) return prepared.issue;
  const byName = new Map(foods.map((food) => [food.name, food.id]));
  await prisma.dietPlan.create({ data: {
    userId: input.userId, name: `Plano inicial ${new Date().toLocaleDateString("pt-BR")}`,
    goal: input.goal, targetCalories: input.targets.calories, targetProteinG: input.targets.proteinG,
    targetCarbsG: input.targets.carbsG, targetFatG: input.targets.fatG, targetFiberG: input.targets.fiberG,
    sodiumLimitMg: input.targets.sodiumMg, isActive: true,
    meals: { create: prepared.meals.map((meal, index) => ({ name: meal.name, order: index + 1,
      items: { create: meal.items.map((item) => ({ foodId: byName.get(item.foodName)!, grams: item.grams })) },
    })) },
  } });
  return null;
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
