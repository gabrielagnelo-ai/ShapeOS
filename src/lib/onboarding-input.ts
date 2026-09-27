import { z } from "zod";
import { MAX_CALORIE_DEFICIT_KCAL } from "./nutrition";

const decimal = (value: FormDataEntryValue | null, fallback?: number) => value === null || String(value).trim() === "" ? fallback : Number(String(value).replace(",", "."));
const inputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sex: z.enum(["male", "female"]), goal: z.enum(["fat_loss", "maintenance", "muscle_gain"]),
  activityLevel: z.enum(["sedentary", "light", "moderate", "high", "very_high"]),
  experience: z.enum(["beginner", "intermediate", "advanced"]), mode: z.enum(["guided", "advanced"]),
  age: z.number().int().min(14).max(90), heightCm: z.number().min(120).max(230), weightKg: z.number().min(35).max(250),
  neckCm: z.number().min(20).max(80), waistCm: z.number().min(40).max(250), hipCm: z.number().min(40).max(250).optional(),
  manualActivityFactor: z.number().min(1.1).max(2.2).optional(), deficitKcal: z.number().min(100).max(MAX_CALORIE_DEFICIT_KCAL),
  proteinPerKg: z.number().min(1.2).max(3), fatPerKg: z.number().min(0.4).max(1.5),
  dietPreference: z.enum(["balanced", "satiety", "pleasure", "low_meal_volume", "simple_repetitive"]),
  restrictions: z.string().max(1000), allergies: z.string().max(1000), dislikedFoods: z.string().max(1000),
  medicalConditions: z.enum(["none", "diabetes", "kidney", "heart", "pregnancy", "eating_disorder", "medication", "other"]),
}).superRefine((data, ctx) => {
  if (data.sex === "female" && !data.hipCm) ctx.addIssue({ code: "custom", path: ["hipCm"], message: "Informe o quadril." });
  if (data.sex === "male" && data.waistCm <= data.neckCm) ctx.addIssue({ code: "custom", path: ["waistCm"], message: "Confira cintura e pescoço." });
});

export function parseOnboardingInput(form: Pick<FormData, "get">, defaultName: string) {
  const height = decimal(form.get("height"));
  return inputSchema.safeParse({
    name: String(form.get("name") ?? defaultName), sex: form.get("sex"), goal: form.get("goal"),
    activityLevel: form.get("activityLevel"), experience: form.get("experience"), mode: form.get("mode"),
    age: decimal(form.get("age")), heightCm: height === undefined ? undefined : height <= 3 ? height * 100 : height,
    weightKg: decimal(form.get("weight")), neckCm: decimal(form.get("neckCm")), waistCm: decimal(form.get("waistCm")),
    hipCm: form.get("sex") === "female" ? decimal(form.get("hipCm")) : undefined,
    manualActivityFactor: form.get("mode") === "advanced" ? decimal(form.get("manualActivityFactor")) : undefined,
    deficitKcal: decimal(form.get("calorieDeficitKcal"), 400), proteinPerKg: decimal(form.get("proteinPerKg"), 2), fatPerKg: decimal(form.get("fatPerKg"), 0.8),
    dietPreference: form.get("dietPreference") || "balanced",
    restrictions: String(form.get("restrictions") ?? ""), allergies: String(form.get("allergies") ?? ""),
    dislikedFoods: String(form.get("dislikedFoods") ?? ""), medicalConditions: form.get("medicalConditions"),
  });
}
