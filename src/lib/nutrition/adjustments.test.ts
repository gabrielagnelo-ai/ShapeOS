import { describe, expect, it } from "vitest";
import { assessDeficitRisk, suggestCalorieAdjustment } from "./index";

describe("automatic adjustments", () => {
  it("reduces calories when fat loss plateaus with adherence", () => {
    const result = suggestCalorieAdjustment({
      goal: "fat_loss",
      currentCalories: 2200,
      weeks: [
        { averageWeightKg: 80, adherencePct: 90, hunger: 5, energy: 7, sleep: 7 },
        { averageWeightKg: 80, adherencePct: 88, hunger: 5, energy: 7, sleep: 7 },
      ],
    });
    expect(result.delta).toBe(-150);
  });

  it("raises calories when fat loss is too aggressive", () => {
    const result = suggestCalorieAdjustment({
      goal: "fat_loss",
      currentCalories: 1800,
      weeks: [
        { averageWeightKg: 80, adherencePct: 90, hunger: 5, energy: 7, sleep: 7 },
        { averageWeightKg: 78.8, adherencePct: 88, hunger: 8, energy: 4, sleep: 6 },
      ],
    });
    expect(result.delta).toBe(150);
  });

  it("raises calories for stalled muscle gain", () => {
    const result = suggestCalorieAdjustment({
      goal: "muscle_gain",
      currentCalories: 2800,
      weeks: [
        { averageWeightKg: 80, adherencePct: 92, hunger: 4, energy: 7, sleep: 7 },
        { averageWeightKg: 80.05, adherencePct: 90, hunger: 4, energy: 7, sleep: 7 },
      ],
    });
    expect(result.delta).toBe(200);
  });

  it("assesses deficit risk by body weight", () => {
    expect(assessDeficitRisk({ weightKg: 117, deficitKcal: 200 }).level).toBe("info");
    expect(assessDeficitRisk({ weightKg: 117, deficitKcal: 500 }).level).toBe("good");
    expect(assessDeficitRisk({ weightKg: 70, deficitKcal: 500 }).level).toBe("warning");
    expect(assessDeficitRisk({ weightKg: 70, deficitKcal: 1000 }).level).toBe("danger");
  });
});
