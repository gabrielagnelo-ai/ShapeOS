import { describe, expect, it } from "vitest";
import { consistencyScore, generateCoachInsights } from "./index";

describe("coach engine", () => {
  it("generates trigger insights ordered by priority", () => {
    const insights = generateCoachInsights({
      proteinLast3DaysPct: [70, 80, 85],
      weightStableDays: 14,
      adherenceStreakDays: 5,
      sleepTrend: "down",
      currentDeficitPct: 26,
      goal: "fat_loss",
      trainingDoneThisWeek: 1,
    });

    expect(insights.map((i) => i.trigger)).toEqual([
      "weight_plateau_14d",
      "aggressive_deficit",
      "protein_drop_3d",
      "sleep_decline",
      "training_low",
      "adherence_streak_5d",
    ]);
  });

  it("calculates consistency score", () => {
    expect(
      consistencyScore({
        dietAdherencePct: 90,
        checkinsDone: 7,
        checkinsTarget: 7,
        proteinHitDays: 6,
        sleepScore: 8,
        trainingDone: 3,
        trainingTarget: 4,
      }),
    ).toBe(87);
  });
});
