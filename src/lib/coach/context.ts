import type { FoodLog, FoodLogItem, Food, WeeklyCheckin } from "@prisma/client";
import { sumNutrients, type Goal, type MacroTargets } from "@/lib/nutrition";
import type { CoachContext } from "./types";

type FoodLogWithItems = FoodLog & {
  items: Array<FoodLogItem & { food: Food }>;
};

export function buildCoachContext(input: {
  goal: Goal;
  tdee: number;
  targetCalories: number;
  proteinTargetG: number;
  lowMicronutrients?: string[];
  foodLogs: FoodLogWithItems[];
  checkins: WeeklyCheckin[];
}): CoachContext {
  const proteinLast3DaysPct =
    input.foodLogs.length >= 3
      ? input.foodLogs.slice(0, 3).map((log) => {
          const consumed = sumNutrients(log.items.map((item) => ({
            grams: item.grams,
            food: {
              name: item.food.name,
              kcalPer100g: item.food.kcalPer100g,
              proteinPer100g: item.food.proteinPer100g,
              carbsPer100g: item.food.carbsPer100g,
              fatPer100g: item.food.fatPer100g,
              fiberPer100g: item.food.fiberPer100g ?? 0,
              sodiumPer100g: item.food.sodiumPer100g ?? 0,
            },
          })));
          return Math.round((consumed.proteinG / input.proteinTargetG) * 100);
        })
      : [];

  const sortedCheckins = [...input.checkins].sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
  const latest = sortedCheckins[0];
  const previous = sortedCheckins[1];
  const weightStableDays = latest && previous && Math.abs(latest.averageWeightKg - previous.averageWeightKg) < 0.2 ? 14 : 0;
  const adherenceStreakDays = input.foodLogs.length >= 5 ? consecutiveMacroDays(input.foodLogs, {
    calories: input.targetCalories,
    proteinG: input.proteinTargetG,
  }) : 0;
  const sleepTrend = latest && previous ? (latest.sleep < previous.sleep ? "down" : latest.sleep > previous.sleep ? "up" : "stable") : "stable";

  return {
    proteinLast3DaysPct,
    weightStableDays,
    adherenceStreakDays,
    sleepTrend,
    currentDeficitPct: input.goal === "fat_loss" ? Math.max(0, Math.round(((input.tdee - input.targetCalories) / input.tdee) * 100)) : 0,
    goal: input.goal,
    trainingDoneThisWeek: latest?.trainingDone ? 3 : 0,
    lowMicronutrients: input.lowMicronutrients,
  };
}

export function hasEnoughCoachData(context: CoachContext) {
  return (
    context.proteinLast3DaysPct.length >= 3 ||
    context.weightStableDays > 0 ||
    context.adherenceStreakDays > 0 ||
    context.sleepTrend === "down" ||
    context.currentDeficitPct >= 25 ||
    Boolean(context.lowMicronutrients?.length)
  );
}

function consecutiveMacroDays(logs: FoodLogWithItems[], target: Pick<MacroTargets, "calories" | "proteinG">) {
  let days = 0;
  for (const log of logs) {
    const consumed = sumNutrients(log.items.map((item) => ({
      grams: item.grams,
      food: {
        name: item.food.name,
        kcalPer100g: item.food.kcalPer100g,
        proteinPer100g: item.food.proteinPer100g,
        carbsPer100g: item.food.carbsPer100g,
        fatPer100g: item.food.fatPer100g,
      },
    })));
    const caloriesOk = consumed.kcal >= target.calories * 0.9 && consumed.kcal <= target.calories * 1.1;
    const proteinOk = consumed.proteinG >= target.proteinG * 0.9;
    if (!caloriesOk || !proteinOk) break;
    days += 1;
  }
  return days;
}
