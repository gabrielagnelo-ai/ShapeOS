"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { parseCircumferences } from "@/lib/body-measurements";
import { parseAppDate } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";
import { MAX_CALORIE_DEFICIT_KCAL, type Goal, type Sex } from "@/lib/nutrition";
import { dailyTargets } from "@/lib/profile-metrics";

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
  const latestBody = await prisma.bodyCompositionSnapshot.findFirst({
    where: { userId: user.id },
    orderBy: { measuredAt: "desc" },
    select: { weightKg: true },
  });

  const goal = goalMap[profile.goal] as Goal;
  const sex = sexMap[profile.sex] as Sex;
  const activityFactor = clampNumber(parseDecimal(String(formData.get("activityFactor") ?? profile.activityFactor)), 1.1, 2.2);
  const calorieDeficitKcal = clampNumber(Number(formData.get("calorieDeficitKcal") ?? profile.calorieDeficitKcal ?? 400), 100, MAX_CALORIE_DEFICIT_KCAL);
  const proteinPerKg = clampNumber(parseDecimal(String(formData.get("proteinPerKg") ?? profile.proteinPerKg ?? 1.8)), 1.2, 3);
  const fatPerKg = clampNumber(parseDecimal(String(formData.get("fatPerKg") ?? profile.fatPerKg ?? 0.8)), 0.4, 1.5);
  const initialWeightKg = clampNumber(parseDecimal(String(formData.get("weightKg") ?? profile.weightKg)), 30, 350);
  const currentWeightKg = latestBody?.weightKg ?? initialWeightKg;
  const neckCm = optionalDecimal(formData.get("neckCm"));
  const waistCm = optionalDecimal(formData.get("waistCm"));
  const hipCm = optionalDecimal(formData.get("hipCm"));
  const circumferences = parseCircumferences(formData);
  const dietPreference = String(formData.get("dietPreference") ?? profile.dietPreference ?? "balanced");
  const waterPreference = normalizeWaterPreference(String(formData.get("waterPreference") ?? profile.waterPreference ?? "medium"));
  const tdeeCalculationMode = normalizeTdeeMode(String(formData.get("tdeeCalculationMode") ?? profile.tdeeCalculationMode));
  const targetWeightKg = optionalDecimal(formData.get("targetWeightKg"));
  const targetWaistCm = optionalDecimal(formData.get("targetWaistCm"));
  const targetBodyFatPct = optionalDecimal(formData.get("targetBodyFatPct"));
  const targetDate = optionalDate(String(formData.get("targetDate") ?? ""));

  // Same rule as every screen; guided and advanced modes give the same targets.
  const { targets } = dailyTargets({
    sex,
    goal,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: currentWeightKg,
    activityFactor,
    tdeeAdjustmentKcal: profile.tdeeAdjustmentKcal,
    calorieDeficitKcal,
    proteinPerKg,
    fatPerKg,
    fiberTargetG: profile.fiberTargetG,
    sodiumLimitMg: profile.sodiumLimitMg,
  });

  await prisma.profile.update({
    where: { userId: user.id },
    data: {
      activityFactor,
      calorieDeficitKcal: goal === "fat_loss" ? calorieDeficitKcal : null,
      targetCalories: targets.calories,
      weightKg: initialWeightKg,
      proteinPerKg,
      fatPerKg,
      neckCm,
      waistCm,
      hipCm,
      ...circumferences,
      dietPreference,
      waterPreference,
      tdeeCalculationMode,
      targetWeightKg,
      targetWaistCm,
      targetBodyFatPct,
      targetDate,
    },
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

function optionalDate(value: string) {
  return value ? parseAppDate(value) : null;
}
