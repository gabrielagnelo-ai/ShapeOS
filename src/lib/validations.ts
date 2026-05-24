import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
});

export const onboardingSchema = z.object({
  name: z.string().min(2),
  sex: z.enum(["male", "female"]),
  age: z.coerce.number().int().min(14).max(90),
  heightCm: z.coerce.number().min(120).max(230),
  weightKg: z.coerce.number().min(35).max(250),
  goal: z.enum(["fat_loss", "maintenance", "muscle_gain"]),
  activityLevel: z.enum(["sedentary", "light", "moderate", "high", "very_high"]),
  experience: z.enum(["beginner", "intermediate", "advanced"]),
  restrictions: z.string().optional(),
  allergies: z.string().optional(),
  dislikedFoods: z.string().optional(),
  medicalConditions: z.string().optional(),
  mode: z.enum(["guided", "advanced"]),
});

export const advancedPlanSchema = z.object({
  targetCalories: z.coerce.number().int().min(1000).max(6000),
  proteinPerKg: z.coerce.number().min(1).max(3.5),
  fatPerKg: z.coerce.number().min(0.3).max(2),
  carbsPerKg: z.coerce.number().min(0).max(10).optional(),
  mealsPerDay: z.coerce.number().int().min(2).max(8),
  fiberTargetG: z.coerce.number().min(10).max(80),
  sodiumLimitMg: z.coerce.number().min(500).max(6000),
});
