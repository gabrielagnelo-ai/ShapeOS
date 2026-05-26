import { describe, expect, it } from "vitest";
import { estimateActivityCalories, estimateMetByEffort, tdeeCheck } from "./activity";

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
});
