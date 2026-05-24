import { generateCoachInsights, dailyBriefing, consistencyScore } from "@/lib/coach";
import { activityFactorFromLevel, calculateBmi, calculateBmr, calculateTdee, estimateBodyFat, guidedMacroTargets } from "@/lib/nutrition";

export const demoProfile = {
  name: "Ana",
  sex: "female" as const,
  age: 32,
  heightCm: 168,
  weightKg: 72,
  neckCm: 34,
  waistCm: 78,
  hipCm: 102,
  goal: "fat_loss" as const,
  activityLevel: "moderate" as const,
};

const bmr = calculateBmr(demoProfile);
const tdee = calculateTdee(bmr, activityFactorFromLevel(demoProfile.activityLevel));
const bmi = calculateBmi(demoProfile.weightKg, demoProfile.heightCm);

export const demoMetrics = {
  bmr,
  tdee,
  bmi,
  bodyFat: estimateBodyFat({
    sex: demoProfile.sex,
    heightCm: demoProfile.heightCm,
    waistCm: demoProfile.waistCm,
    neckCm: demoProfile.neckCm,
    hipCm: demoProfile.hipCm,
  }),
  targets: guidedMacroTargets({ weightKg: demoProfile.weightKg, tdee, goal: demoProfile.goal, fiberG: 30, sodiumMg: 2300 }),
};

export const demoMeals = [
  { name: "Cafe da manha", kcal: 420, protein: 31, carbs: 52, fat: 10, items: ["Iogurte natural", "Aveia", "Banana"] },
  { name: "Almoco", kcal: 620, protein: 48, carbs: 72, fat: 15, items: ["Arroz", "Feijao", "Frango", "Brocolis"] },
  { name: "Pre-treino", kcal: 260, protein: 24, carbs: 34, fat: 4, items: ["Whey", "Maca"] },
  { name: "Jantar", kcal: 540, protein: 44, carbs: 50, fat: 18, items: ["Tilapia", "Batata doce", "Salada", "Azeite"] },
];

export const demoInsights = generateCoachInsights({
  proteinLast3DaysPct: [82, 78, 84],
  weightStableDays: 14,
  adherenceStreakDays: 5,
  sleepTrend: "down",
  currentDeficitPct: 18,
  goal: "fat_loss",
  trainingDoneThisWeek: 3,
});

export const demoBriefing = dailyBriefing({
  averageWeightKg: 71.8,
  adherencePct: 88,
  macroCompletionPct: 92,
  sleepScore: 6,
  insights: demoInsights,
});

export const demoConsistencyScore = consistencyScore({
  dietAdherencePct: 88,
  checkinsDone: 6,
  checkinsTarget: 7,
  proteinHitDays: 5,
  sleepScore: 7,
  trainingDone: 4,
  trainingTarget: 4,
});

export const foodRows = [
  ["Arroz branco cozido", "Cereais", 128, 2.5, 28.1, 0.2],
  ["Feijao carioca", "Leguminosas", 76, 4.8, 13.6, 0.5],
  ["Peito de frango", "Carnes", 159, 32, 0, 2.5],
  ["Ovo inteiro", "Ovos", 143, 13, 1.6, 8.9],
  ["Batata doce", "Tuberculos", 77, 0.6, 18.4, 0.1],
  ["Banana prata", "Frutas", 98, 1.3, 26, 0.1],
];
