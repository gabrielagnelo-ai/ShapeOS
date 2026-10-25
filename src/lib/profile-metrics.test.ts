import { describe, expect, it } from "vitest";
import { advancedMacroTargets, calculateBmr, calculateTdee } from "./nutrition";
import { computeProfileMetrics, dailyTargets } from "./profile-metrics";

// Male, 30 years, 180 cm, 80 kg, moderate activity, losing fat with a 400 kcal deficit.
const profile = {
  sex: "MALE",
  goal: "FAT_LOSS",
  age: 30,
  heightCm: 180,
  weightKg: 80,
  neckCm: 38,
  waistCm: 86,
  hipCm: null,
  activityFactor: 1.55,
  tdeeAdjustmentKcal: 0,
  calorieDeficitKcal: 400,
  proteinPerKg: 1.8,
  fatPerKg: 0.8,
  fiberTargetG: null,
  sodiumLimitMg: null,
  calciumTargetMg: null,
  ironTargetMg: null,
  magnesiumTargetMg: null,
  potassiumTargetMg: null,
  zincTargetMg: null,
  vitaminCTargetMg: null,
  vitaminDTargetMcg: null,
  vitaminB12TargetMcg: null,
} satisfies Parameters<typeof computeProfileMetrics>[0];

const fatLossTargets = { calories: 2359, proteinG: 144, fatG: 64, carbsG: 302, fiberG: 30, sodiumMg: 2300 };

describe("computeProfileMetrics", () => {
  it("computes expenditure and daily targets for a fat-loss profile", () => {
    const metrics = computeProfileMetrics(profile);
    expect(metrics.bmr).toBe(1780);
    expect(metrics.tdee).toBe(2759);
    expect(metrics.targets).toEqual(fatLossTargets);
  });

  it("uses the latest body weight when it is given", () => {
    const metrics = computeProfileMetrics(profile, { weightKg: 90 });
    expect(metrics.bmr).toBe(1880);
    expect(metrics.tdee).toBe(2914);
    expect(metrics.targets).toMatchObject({ calories: 2514, proteinG: 162, fatG: 72, carbsG: 305 });
  });

  it("adds the manual expenditure adjustment", () => {
    const metrics = computeProfileMetrics({ ...profile, tdeeAdjustmentKcal: 120 });
    expect(metrics.tdee).toBe(2879);
    expect(metrics.targets.calories).toBe(2479);
  });

  it("adds 300 kcal to gain muscle and keeps the expenditure to maintain", () => {
    expect(computeProfileMetrics({ ...profile, goal: "MUSCLE_GAIN" }).targets.calories).toBe(3059);
    expect(computeProfileMetrics({ ...profile, goal: "MAINTENANCE" }).targets.calories).toBe(2759);
  });

  it("falls back to the guided defaults when the profile leaves settings empty", () => {
    const metrics = computeProfileMetrics({ ...profile, calorieDeficitKcal: null, proteinPerKg: null, fatPerKg: null });
    expect(metrics.targets).toEqual(fatLossTargets);
  });
});

describe("dailyTargets", () => {
  const settings = {
    sex: "male",
    goal: "fat_loss",
    age: 30,
    heightCm: 180,
    weightKg: 80,
    activityFactor: 1.55,
    tdeeAdjustmentKcal: 0,
    calorieDeficitKcal: 400,
    proteinPerKg: 1.8,
    fatPerKg: 0.8,
  } as const;

  it("is the rule computeProfileMetrics uses", () => {
    const { bmr, tdee, targets } = computeProfileMetrics(profile);
    expect(dailyTargets(settings)).toEqual({ bmr, tdee, targets });
  });

  it("matches the expenditure the screens used to compute by hand", () => {
    const bmr = calculateBmr({ sex: "male", age: 30, heightCm: 180, weightKg: 80 });
    expect(dailyTargets({ ...settings, tdeeAdjustmentKcal: 120 }).tdee).toBe(calculateTdee(bmr, 1.55) + 120);
  });

  it("matches the advanced formula that onboarding and settings used when saving", () => {
    for (const [goal, calories] of [["fat_loss", 2759 - 400], ["muscle_gain", 2759 + 300], ["maintenance", 2759]] as const) {
      expect(dailyTargets({ ...settings, goal }).targets).toEqual(
        advancedMacroTargets({ calories, weightKg: 80, proteinPerKg: 1.8, fatPerKg: 0.8, useRemainingCarbs: true, fiberG: 30, sodiumMg: 2300 }),
      );
    }
  });
});
