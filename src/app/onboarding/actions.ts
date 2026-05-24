"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createBodyCompositionSnapshot } from "@/lib/body-composition";
import { prisma } from "@/lib/prisma";
import { activityFactors, advancedMacroTargets, guidedMacroTargets, calculateBmr, calculateTdee, type ActivityLevel, type Goal, type Sex } from "@/lib/nutrition";

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

  const sex = String(formData.get("sex")) as Sex;
  const goal = String(formData.get("goal")) as Goal;
  const activityLevel = String(formData.get("activityLevel")) as ActivityLevel;
  const experience = String(formData.get("experience")) as keyof typeof experienceMap;
  const mode = String(formData.get("mode")) as keyof typeof modeMap;
  const age = Number(formData.get("age"));
  const heightCm = normalizeHeight(String(formData.get("height") ?? ""));
  const weightKg = normalizeDecimal(String(formData.get("weight") ?? ""));
  const neckCm = optionalDecimal(formData.get("neckCm"));
  const waistCm = optionalDecimal(formData.get("waistCm"));
  const hipCm = sex === "female" ? optionalDecimal(formData.get("hipCm")) : null;
  const guidedActivityFactor = activityFactors[activityLevel];
  const manualActivityFactor = normalizeDecimal(String(formData.get("manualActivityFactor") ?? ""));
  const activityFactor =
    mode === "advanced" && Number.isFinite(manualActivityFactor) && manualActivityFactor >= 1.1 && manualActivityFactor <= 2.2
      ? manualActivityFactor
      : guidedActivityFactor;

  const bmr = calculateBmr({ sex, age, heightCm, weightKg });
  const tdee = calculateTdee(bmr, activityFactor);
  const requestedDeficit = Number(formData.get("calorieDeficitKcal") ?? 400);
  const deficitKcal = Number.isFinite(requestedDeficit) ? Math.min(1000, Math.max(100, requestedDeficit)) : 400;
  const calorieAdjustment = goal === "fat_loss" ? -deficitKcal : undefined;
  const proteinPerKg = clampNumber(normalizeDecimal(String(formData.get("proteinPerKg") ?? "2")), 1.2, 3);
  const fatPerKg = clampNumber(normalizeDecimal(String(formData.get("fatPerKg") ?? "0.8")), 0.4, 1.5);
  const targets =
    mode === "advanced"
      ? advancedMacroTargets({ calories: goal === "fat_loss" ? tdee - deficitKcal : goal === "muscle_gain" ? tdee + 300 : tdee, weightKg, proteinPerKg, fatPerKg, useRemainingCarbs: true, fiberG: 30, sodiumMg: 2300 })
      : guidedMacroTargets({ weightKg, tdee, goal, calorieAdjustment, proteinPerKg, fatPerKg, fiberG: 30, sodiumMg: 2300 });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: String(formData.get("name") ?? user.name).trim(),
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
            restrictions: splitList(String(formData.get("restrictions") ?? "")),
            allergies: splitList(String(formData.get("allergies") ?? "")),
            dislikedFoods: splitList(String(formData.get("dislikedFoods") ?? "")),
            medicalConditions: splitList(String(formData.get("medicalConditions") ?? "")),
            dietPreference: String(formData.get("dietPreference") ?? "balanced"),
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
            restrictions: splitList(String(formData.get("restrictions") ?? "")),
            allergies: splitList(String(formData.get("allergies") ?? "")),
            dislikedFoods: splitList(String(formData.get("dislikedFoods") ?? "")),
            medicalConditions: splitList(String(formData.get("medicalConditions") ?? "")),
            dietPreference: String(formData.get("dietPreference") ?? "balanced"),
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

  redirect("/dashboard");
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDecimal(value: string) {
  return Number(value.replace(",", "."));
}

function normalizeHeight(value: string) {
  const parsed = normalizeDecimal(value);
  return parsed > 3 ? parsed : Math.round(parsed * 100);
}

function optionalDecimal(value: FormDataEntryValue | null) {
  if (!value) return null;
  const parsed = normalizeDecimal(String(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
