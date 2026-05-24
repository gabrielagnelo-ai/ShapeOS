import { activityFactors, type ActivityLevel, type Goal, type MacroTargets, type Sex } from "./types";

export function calculateBmr(input: { sex: Sex; weightKg: number; heightCm: number; age: number }) {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return Math.round(input.sex === "male" ? base + 5 : base - 161);
}

export function calculateTdee(bmr: number, activityFactor: number) {
  return Math.round(bmr * activityFactor);
}

export function calculateBmi(weightKg: number, heightCm: number) {
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

export function estimateBodyFat(input: {
  sex: Sex;
  heightCm: number;
  waistCm?: number | null;
  neckCm?: number | null;
  hipCm?: number | null;
}) {
  const heightIn = cmToInches(input.heightCm);
  const waistIn = cmToInches(input.waistCm ?? 0);
  const neckIn = cmToInches(input.neckCm ?? 0);
  const hipIn = cmToInches(input.hipCm ?? 0);

  const hasRequiredMeasurements =
    input.sex === "male"
      ? heightIn > 0 && waistIn > neckIn && neckIn > 0
      : heightIn > 0 && waistIn + hipIn > neckIn && neckIn > 0 && hipIn > 0;

  if (!hasRequiredMeasurements) {
    return {
      percentage: null,
      limitation:
        "Informe cintura, pescoço e, para mulheres, quadril para calcular pelo método da Marinha Americana.",
    };
  }

  const value =
    input.sex === "male"
      ? 86.01 * Math.log10(waistIn - neckIn) - 70.041 * Math.log10(heightIn) + 36.76
      : 163.205 * Math.log10(waistIn + hipIn - neckIn) - 97.684 * Math.log10(heightIn) - 78.387;

  return {
    percentage: Number(Math.max(3, value).toFixed(1)),
    limitation:
      "Estimativa pelo método da Marinha Americana; depende de medidas bem tiradas e não substitui avaliação profissional.",
  };
}

function cmToInches(value: number) {
  return value / 2.54;
}

export function calorieTargetByGoal(tdee: number, goal: Goal, adjustment?: number) {
  if (goal === "maintenance") return tdee;
  if (typeof adjustment === "number") return Math.round(tdee + adjustment);
  return goal === "fat_loss" ? tdee - 400 : tdee + 300;
}

export function guidedMacroTargets(input: {
  weightKg: number;
  tdee: number;
  goal: Goal;
  proteinPerKg?: number;
  fatPerKg?: number;
  calorieAdjustment?: number;
  fiberG?: number;
  sodiumMg?: number;
}): MacroTargets {
  const calories = calorieTargetByGoal(input.tdee, input.goal, input.calorieAdjustment);
  const proteinG = Math.round(input.weightKg * (input.proteinPerKg ?? 1.8));
  const fatG = Math.round(input.weightKg * (input.fatPerKg ?? 0.8));
  const remainingCalories = calories - proteinG * 4 - fatG * 9;
  const carbsG = Math.max(0, Math.round(remainingCalories / 4));

  return {
    calories,
    proteinG,
    fatG,
    carbsG,
    fiberG: input.fiberG,
    sodiumMg: input.sodiumMg,
  };
}

export function advancedMacroTargets(input: {
  calories: number;
  weightKg: number;
  proteinPerKg: number;
  fatPerKg: number;
  carbsPerKg?: number;
  useRemainingCarbs?: boolean;
  fiberG?: number;
  sodiumMg?: number;
}): MacroTargets {
  const proteinG = Math.round(input.weightKg * input.proteinPerKg);
  const fatG = Math.round(input.weightKg * input.fatPerKg);
  const carbsG = input.useRemainingCarbs
    ? Math.max(0, Math.round((input.calories - proteinG * 4 - fatG * 9) / 4))
    : Math.round(input.weightKg * (input.carbsPerKg ?? 0));

  return {
    calories: input.calories,
    proteinG,
    fatG,
    carbsG,
    fiberG: input.fiberG,
    sodiumMg: input.sodiumMg,
  };
}

export function activityFactorFromLevel(level: ActivityLevel) {
  return activityFactors[level];
}
