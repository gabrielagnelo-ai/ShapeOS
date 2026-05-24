import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateBmi,
  calculateBmr,
  calculateTdee,
  estimateBodyFat,
  guidedMacroTargets,
  suggestedMicronutrientTargets,
  type Goal,
  type Sex,
} from "@/lib/nutrition";

const sexMap = { MALE: "male", FEMALE: "female" } as const;
const goalMap = { FAT_LOSS: "fat_loss", MAINTENANCE: "maintenance", MUSCLE_GAIN: "muscle_gain" } as const;

export async function requireUserProfile() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?erro=Sessao nao encontrada. Entre novamente.");

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

  return { user, profile };
}

export function computeProfileMetrics(profile: Awaited<ReturnType<typeof requireUserProfile>>["profile"]) {
  const sex = sexMap[profile.sex] as Sex;
  const goal = goalMap[profile.goal] as Goal;
  const bmr = calculateBmr({ sex, age: profile.age, heightCm: profile.heightCm, weightKg: profile.weightKg });
  const tdee = calculateTdee(bmr, profile.activityFactor);
  const bmi = calculateBmi(profile.weightKg, profile.heightCm);
  const bodyFat = estimateBodyFat({
    sex,
    heightCm: profile.heightCm,
    waistCm: profile.waistCm,
    neckCm: profile.neckCm,
    hipCm: profile.hipCm,
  });
  const targets = guidedMacroTargets({
    weightKg: profile.weightKg,
    tdee,
    goal,
    calorieAdjustment: goal === "fat_loss" ? -(profile.calorieDeficitKcal ?? 400) : undefined,
    proteinPerKg: profile.proteinPerKg ?? 1.8,
    fatPerKg: profile.fatPerKg ?? 0.8,
    fiberG: profile.fiberTargetG ?? 30,
    sodiumMg: profile.sodiumLimitMg ?? 2300,
  });
  const suggestedMicros = suggestedMicronutrientTargets({ sex, age: profile.age });
  const micronutrientTargets = {
    calciumMg: profile.calciumTargetMg ?? suggestedMicros.calciumMg,
    ironMg: profile.ironTargetMg ?? suggestedMicros.ironMg,
    magnesiumMg: profile.magnesiumTargetMg ?? suggestedMicros.magnesiumMg,
    potassiumMg: profile.potassiumTargetMg ?? suggestedMicros.potassiumMg,
    zincMg: profile.zincTargetMg ?? suggestedMicros.zincMg,
    vitaminCMg: profile.vitaminCTargetMg ?? suggestedMicros.vitaminCMg,
    vitaminDMcg: profile.vitaminDTargetMcg ?? suggestedMicros.vitaminDMcg,
    vitaminB12Mcg: profile.vitaminB12TargetMcg ?? suggestedMicros.vitaminB12Mcg,
  };

  return { sex, goal, bmr, tdee, bmi, bodyFat, targets, micronutrientTargets };
}

export function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}
