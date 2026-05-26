import { describe, expect, it } from "vitest";
import { averageWalkingSpeed, classifyWalkingBySpeed, estimateActivityCalories, estimateMetByEffort, estimateWalkingFromDistanceTime, tdeeCheck } from "./activity";
import { activityContribution, shouldCountActivity, validateTdeeTrend } from "./tdee";

describe("activity estimates", () => {
  it("estimates calories from MET, body weight and duration", () => {
    expect(estimateActivityCalories({ met: 5, weightKg: 100, durationMinutes: 60 })).toBe(500);
    expect(estimateActivityCalories({ met: 8, weightKg: 75, durationMinutes: 30 })).toBe(300);
  });

  it("compares logged activity against estimated TDEE", () => {
    const result = tdeeCheck({ estimatedTdee: 3000, loggedActivityKcal: 650, baselineActivityKcal: 400 });

    expect(result.checkedTdee).toBe(3250);
    expect(result.delta).toBe(250);
    expect(result.label).toBe("dia mais ativo");
  });

  it("adjusts activity intensity without exposing technical fields", () => {
    expect(estimateMetByEffort(5, "light")).toBe(4.3);
    expect(estimateMetByEffort(5, "moderate")).toBe(5);
    expect(estimateMetByEffort(5, "hard")).toBe(5.9);
  });

  it("calculates walking from distance and duration", () => {
    expect(averageWalkingSpeed({ distanceKm: 4, durationMinutes: 60 })).toBe(4);
    expect(classifyWalkingBySpeed(3.9)).toMatchObject({ intensity: "Leve", met: 2.8 });
    expect(classifyWalkingBySpeed(5)).toMatchObject({ intensity: "Moderada", met: 3.5 });
    expect(classifyWalkingBySpeed(5.6)).toMatchObject({ intensity: "Rapida", met: 4.3 });

    const estimate = estimateWalkingFromDistanceTime({ distanceKm: 5, durationMinutes: 60, weightKg: 100 });
    expect(estimate.speedKmh).toBe(5);
    expect(estimate.caloriesKcal).toBe(368);
    expect(estimate.conservativeCaloriesKcal).toBe(324);
  });

  it("prevents double counting strength training in coefficient mode", () => {
    expect(shouldCountActivity({ mode: "COEFFICIENT", activityFactor: 1.65, activityKey: "weight_training" })).toBe(false);
    expect(shouldCountActivity({ mode: "COEFFICIENT", activityFactor: 1.65, activityKey: "walk_fast" })).toBe(true);
    expect(shouldCountActivity({ mode: "ADDITIVE", activityFactor: 1.2, activityKey: "weight_training" })).toBe(true);
  });

  it("uses conservative calories for counted manual activities", () => {
    const result = activityContribution({
      mode: "COEFFICIENT",
      activityFactor: 1.65,
      activities: [
        { activityKey: "weight_training", caloriesKcal: 690, countsTowardTdee: false },
        { activityKey: "walk_fast", caloriesKcal: 400, countsTowardTdee: true },
      ],
    });

    expect(result.rawKcal).toBe(1090);
    expect(result.countedKcal).toBe(340);
    expect(result.ignoredKcal).toBe(690);
  });

  it("marks TDEE confidence low when expected deficit does not move weight or waist", () => {
    const result = validateTdeeTrend({
      tdee: 3700,
      averageIntakeKcal: 2700,
      checkins: [
        { averageWeightKg: 117, waistCm: 106 },
        { averageWeightKg: 117, waistCm: 106.2 },
        { averageWeightKg: 117.1, waistCm: 106.1 },
      ],
    });

    expect(result.confidence).toBe("LOW");
    expect(result.suggestedAdjustmentKcal).toBeLessThan(0);
  });
});
