import type { Profile } from "@prisma/client";
import {
  calculateBmi,
  calculateBmr,
  estimateBodyFat,
  guidedMacroTargets,
  suggestedMicronutrientTargets,
  type Goal,
  type Sex,
} from "@/lib/nutrition";
import { calculateBaseTdee } from "@/lib/tdee";

const sexMap = { MALE: "male", FEMALE: "female" } as const;
const goalMap = { FAT_LOSS: "fat_loss", MAINTENANCE: "maintenance", MUSCLE_GAIN: "muscle_gain" } as const;

type MetricsProfile = Pick<
  Profile,
  | "sex" | "goal" | "age" | "heightCm" | "weightKg" | "neckCm" | "waistCm" | "hipCm"
  | "activityFactor" | "tdeeAdjustmentKcal" | "calorieDeficitKcal" | "proteinPerKg" | "fatPerKg"
  | "fiberTargetG" | "sodiumLimitMg" | "calciumTargetMg" | "ironTargetMg" | "magnesiumTargetMg"
  | "potassiumTargetMg" | "zincTargetMg" | "vitaminCTargetMg" | "vitaminDTargetMcg" | "vitaminB12TargetMcg"
>;

/**
 * The one rule for the daily targets: expenditure (BMR × activity + manual adjustment)
 * and calories and macros for the goal. Every screen and every save uses it, so the
 * targets cannot disagree. Empty settings fall back to the guided defaults.
 */
export function dailyTargets(input: {
  sex: Sex;
  goal: Goal;
  age: number;
  heightCm: number;
  weightKg: number;
  activityFactor: number;
  tdeeAdjustmentKcal?: number | null;
  calorieDeficitKcal?: number | null;
  proteinPerKg?: number | null;
  fatPerKg?: number | null;
  fiberTargetG?: number | null;
  sodiumLimitMg?: number | null;
}) {
  const bmr = calculateBmr({ sex: input.sex, age: input.age, heightCm: input.heightCm, weightKg: input.weightKg });
  const tdee = calculateBaseTdee({ bmr, activityFactor: input.activityFactor, adjustmentKcal: input.tdeeAdjustmentKcal });
  const targets = guidedMacroTargets({
    weightKg: input.weightKg,
    tdee,
    goal: input.goal,
    calorieAdjustment: input.goal === "fat_loss" ? -(input.calorieDeficitKcal ?? 400) : undefined,
    proteinPerKg: input.proteinPerKg ?? 1.8,
    fatPerKg: input.fatPerKg ?? 0.8,
    fiberG: input.fiberTargetG ?? 30,
    sodiumMg: input.sodiumLimitMg ?? 2300,
  });
  return { bmr, tdee, targets };
}

export function computeProfileMetrics(
  profile: MetricsProfile,
  body?: { weightKg?: number; neckCm?: number | null; waistCm?: number | null; hipCm?: number | null },
) {
  const sex = sexMap[profile.sex] as Sex;
  const goal = goalMap[profile.goal] as Goal;
  const weightKg = body?.weightKg ?? profile.weightKg;
  const neckCm = body?.neckCm ?? profile.neckCm;
  const waistCm = body?.waistCm ?? profile.waistCm;
  const hipCm = body?.hipCm ?? profile.hipCm;
  const { bmr, tdee, targets } = dailyTargets({ ...profile, sex, goal, weightKg });
  const bmi = calculateBmi(weightKg, profile.heightCm);
  const bodyFat = estimateBodyFat({
    sex,
    heightCm: profile.heightCm,
    waistCm,
    neckCm,
    hipCm,
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
