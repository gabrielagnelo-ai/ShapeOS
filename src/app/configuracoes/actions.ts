"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createBodyCompositionSnapshot } from "@/lib/body-composition";
import { prisma } from "@/lib/prisma";
import { advancedMacroTargets, calculateBmr, calculateTdee, guidedMacroTargets, type Goal, type Sex } from "@/lib/nutrition";

const goalMap = {
  FAT_LOSS: "fat_loss",
  MAINTENANCE: "maintenance",
  MUSCLE_GAIN: "muscle_gain",
} as const;

const sexMap = {
  MALE: "male",
  FEMALE: "female",
} as const;

export async function updateGoalsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

  const goal = goalMap[profile.goal] as Goal;
  const sex = sexMap[profile.sex] as Sex;
  const activityFactor = clampNumber(parseDecimal(String(formData.get("activityFactor") ?? profile.activityFactor)), 1.1, 2.2);
  const calorieDeficitKcal = clampNumber(Number(formData.get("calorieDeficitKcal") ?? profile.calorieDeficitKcal ?? 400), 100, 1000);
  const proteinPerKg = clampNumber(parseDecimal(String(formData.get("proteinPerKg") ?? profile.proteinPerKg ?? 1.8)), 1.2, 3);
  const fatPerKg = clampNumber(parseDecimal(String(formData.get("fatPerKg") ?? profile.fatPerKg ?? 0.8)), 0.4, 1.5);
  const weightKg = clampNumber(parseDecimal(String(formData.get("weightKg") ?? profile.weightKg)), 30, 350);
  const neckCm = optionalDecimal(formData.get("neckCm"));
  const waistCm = optionalDecimal(formData.get("waistCm"));
  const hipCm = profile.sex === "FEMALE" ? optionalDecimal(formData.get("hipCm")) : null;
  const dietPreference = String(formData.get("dietPreference") ?? profile.dietPreference ?? "balanced");
  const waterPreference = normalizeWaterPreference(String(formData.get("waterPreference") ?? profile.waterPreference ?? "medium"));
  const tdeeCalculationMode = normalizeTdeeMode(String(formData.get("tdeeCalculationMode") ?? profile.tdeeCalculationMode));

  const bmr = calculateBmr({ sex, age: profile.age, heightCm: profile.heightCm, weightKg });
  const tdee = calculateTdee(bmr, activityFactor) + profile.tdeeAdjustmentKcal;
  const targets =
    profile.mode === "ADVANCED"
      ? advancedMacroTargets({
          calories: goal === "fat_loss" ? tdee - calorieDeficitKcal : goal === "muscle_gain" ? tdee + 300 : tdee,
          weightKg,
          proteinPerKg,
          fatPerKg,
          useRemainingCarbs: true,
          fiberG: profile.fiberTargetG ?? 30,
          sodiumMg: profile.sodiumLimitMg ?? 2300,
        })
      : guidedMacroTargets({
          weightKg,
          tdee,
          goal,
          calorieAdjustment: goal === "fat_loss" ? -calorieDeficitKcal : undefined,
          proteinPerKg,
          fatPerKg,
          fiberG: profile.fiberTargetG ?? 30,
          sodiumMg: profile.sodiumLimitMg ?? 2300,
        });

  await prisma.profile.update({
    where: { userId: user.id },
    data: {
      activityFactor,
      calorieDeficitKcal: goal === "fat_loss" ? calorieDeficitKcal : null,
      targetCalories: targets.calories,
      weightKg,
      proteinPerKg,
      fatPerKg,
      neckCm,
      waistCm,
      hipCm,
      dietPreference,
      waterPreference,
      tdeeCalculationMode,
    },
  });

  await createBodyCompositionSnapshot({
    userId: user.id,
    source: "profile_update",
    sex,
    heightCm: profile.heightCm,
    weightKg,
    neckCm,
    waistCm,
    hipCm,
  });

  redirect("/dashboard");
}

function parseDecimal(value: string) {
  return Number(value.replace(",", "."));
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function optionalDecimal(value: FormDataEntryValue | null) {
  if (!value) return null;
  const parsed = parseDecimal(String(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeWaterPreference(value: string) {
  return ["minimum", "medium", "high"].includes(value) ? value : "medium";
}

function normalizeTdeeMode(value: string) {
  return value === "ADDITIVE" ? "ADDITIVE" : "COEFFICIENT";
}
