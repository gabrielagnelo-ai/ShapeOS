import type { FoodNutrients, MacroTargets } from "./types";

export function nutrientsForGrams(food: FoodNutrients, grams: number) {
  const ratio = grams / 100;
  return {
    kcal: round(food.kcalPer100g * ratio),
    proteinG: round(food.proteinPer100g * ratio),
    carbsG: round(food.carbsPer100g * ratio),
    fatG: round(food.fatPer100g * ratio),
    fiberG: round((food.fiberPer100g ?? 0) * ratio),
    sodiumMg: round((food.sodiumPer100g ?? 0) * ratio),
    calciumMg: round((food.calciumPer100g ?? 0) * ratio),
    ironMg: round((food.ironPer100g ?? 0) * ratio),
    magnesiumMg: round((food.magnesiumPer100g ?? 0) * ratio),
    potassiumMg: round((food.potassiumPer100g ?? 0) * ratio),
    zincMg: round((food.zincPer100g ?? 0) * ratio),
    vitaminCMg: round((food.vitaminCPer100g ?? 0) * ratio),
    vitaminDMcg: round((food.vitaminDPer100g ?? 0) * ratio),
    vitaminB12Mcg: round((food.vitaminB12Per100g ?? 0) * ratio),
  };
}

export function sumNutrients(items: Array<{ food: FoodNutrients; grams: number }>) {
  return items.reduce(
    (acc, item) => {
      const n = nutrientsForGrams(item.food, item.grams);
      return {
        kcal: round(acc.kcal + n.kcal),
        proteinG: round(acc.proteinG + n.proteinG),
        carbsG: round(acc.carbsG + n.carbsG),
        fatG: round(acc.fatG + n.fatG),
        fiberG: round(acc.fiberG + n.fiberG),
        sodiumMg: round(acc.sodiumMg + n.sodiumMg),
        calciumMg: round(acc.calciumMg + n.calciumMg),
        ironMg: round(acc.ironMg + n.ironMg),
        magnesiumMg: round(acc.magnesiumMg + n.magnesiumMg),
        potassiumMg: round(acc.potassiumMg + n.potassiumMg),
        zincMg: round(acc.zincMg + n.zincMg),
        vitaminCMg: round(acc.vitaminCMg + n.vitaminCMg),
        vitaminDMcg: round(acc.vitaminDMcg + n.vitaminDMcg),
        vitaminB12Mcg: round(acc.vitaminB12Mcg + n.vitaminB12Mcg),
      };
    },
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sodiumMg: 0, calciumMg: 0, ironMg: 0, magnesiumMg: 0, potassiumMg: 0, zincMg: 0, vitaminCMg: 0, vitaminDMcg: 0, vitaminB12Mcg: 0 },
  );
}

export function macroProgress(consumed: ReturnType<typeof sumNutrients>, target: MacroTargets) {
  return {
    calories: percent(consumed.kcal, target.calories),
    protein: percent(consumed.proteinG, target.proteinG),
    carbs: percent(consumed.carbsG, target.carbsG),
    fat: percent(consumed.fatG, target.fatG),
    fiber: target.fiberG ? percent(consumed.fiberG, target.fiberG) : undefined,
    sodium: target.sodiumMg ? percent(consumed.sodiumMg, target.sodiumMg) : undefined,
  };
}

function percent(value: number, target: number) {
  if (!target) return 0;
  return Math.round((value / target) * 100);
}

function round(value: number) {
  return Number(value.toFixed(1));
}
