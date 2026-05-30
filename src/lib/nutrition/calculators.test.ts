import { describe, expect, it } from "vitest";
import { advancedMacroTargets, calculateBmi, calculateBmr, calculateTdee, estimateBodyFat, guidedMacroTargets } from "./index";

describe("nutrition calculators", () => {
  it("calculates male and female BMR with Mifflin-St Jeor", () => {
    expect(calculateBmr({ sex: "male", weightKg: 80, heightCm: 180, age: 30 })).toBe(1780);
    expect(calculateBmr({ sex: "female", weightKg: 60, heightCm: 165, age: 30 })).toBe(1320);
  });

  it("calculates TDEE", () => {
    expect(calculateTdee(1780, 1.55)).toBe(2759);
  });

  it("calculates BMI", () => {
    expect(calculateBmi(72, 168)).toBe(25.5);
  });

  it("calculates guided macros with remaining carbs", () => {
    expect(guidedMacroTargets({ weightKg: 80, tdee: 2800, goal: "fat_loss" })).toEqual({
      calories: 2400,
      proteinG: 144,
      fatG: 64,
      carbsG: 312,
      fiberG: undefined,
      sodiumMg: undefined,
    });
  });

  it("calculates advanced macros", () => {
    expect(advancedMacroTargets({ calories: 2500, weightKg: 80, proteinPerKg: 2, fatPerKg: 0.8, useRemainingCarbs: true }).carbsG).toBe(321);
  });

  it("estimates body fat with the US Navy method", () => {
    expect(estimateBodyFat({ sex: "male", heightCm: 192, waistCm: 108, neckCm: 42 }).percentage).toBe(26.3);
    expect(estimateBodyFat({ sex: "male", heightCm: 192, waistCm: 107, neckCm: 42 }).percentage).toBe(25.8);
    expect(estimateBodyFat({ sex: "female", heightCm: 165, waistCm: 76, neckCm: 34, hipCm: 100 }).percentage).toBe(29.7);
  });

  it("does not estimate Navy body fat without required measurements", () => {
    expect(estimateBodyFat({ sex: "male", heightCm: 180 }).percentage).toBeNull();
    expect(estimateBodyFat({ sex: "female", heightCm: 165, waistCm: 76, neckCm: 34 }).percentage).toBeNull();
  });
});
