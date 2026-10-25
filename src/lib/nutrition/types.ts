export type Sex = "male" | "female";
export type Goal = "fat_loss" | "maintenance" | "muscle_gain";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "high" | "very_high";

export const activityFactors: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  very_high: 1.9,
};

export type MacroTargets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sodiumMg?: number;
};

export type FoodNutrients = {
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number;
  sodiumPer100g?: number;
  calciumPer100g?: number;
  ironPer100g?: number;
  magnesiumPer100g?: number;
  potassiumPer100g?: number;
  zincPer100g?: number;
  vitaminCPer100g?: number;
  vitaminDPer100g?: number;
  vitaminB12Per100g?: number;
};

/** A food as the database returns it: nutrients the label did not report are null. */
export type StoredFoodNutrients = {
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number | null;
  sodiumPer100g?: number | null;
  calciumPer100g?: number | null;
  ironPer100g?: number | null;
  magnesiumPer100g?: number | null;
  potassiumPer100g?: number | null;
  zincPer100g?: number | null;
  vitaminCPer100g?: number | null;
  vitaminDPer100g?: number | null;
  vitaminB12Per100g?: number | null;
};

export type MicronutrientTargets = {
  calciumMg: number;
  ironMg: number;
  magnesiumMg: number;
  potassiumMg: number;
  zincMg: number;
  vitaminCMg: number;
  vitaminDMcg: number;
  vitaminB12Mcg: number;
};
