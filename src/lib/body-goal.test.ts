import { describe, expect, it } from "vitest";
import { buildBodyGoalProjection } from "./body-goal";

describe("body goal projection", () => {
  it("estimates target date from weekly weight trend", () => {
    const projection = buildBodyGoalProjection({
      currentWeightKg: 115,
      targetWeightKg: 110,
      checkins: [
        { averageWeightKg: 117, weekStart: new Date("2026-05-03") },
        { averageWeightKg: 116, weekStart: new Date("2026-05-10") },
        { averageWeightKg: 115, weekStart: new Date("2026-05-17") },
      ],
    });

    expect(projection.hasGoal).toBe(true);
    expect(projection.estimatedWeeks).toBe(5);
    expect(projection.paceLabel).toBe("prazo estimado");
  });

  it("marks desired deadline as aggressive when current pace is too slow", () => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 14);

    const projection = buildBodyGoalProjection({
      currentWeightKg: 117,
      targetWeightKg: 110,
      targetDate,
      checkins: [],
    });

    expect(projection.paceLabel).toBe("prazo agressivo");
  });
});
