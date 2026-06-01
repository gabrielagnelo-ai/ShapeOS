import { describe, expect, it } from "vitest";
import { analyzeTrainingPerformance, parseRepsValue } from "./training-performance";

describe("training performance", () => {
  it("parses common repetition formats", () => {
    expect(parseRepsValue("10/9/8")).toBe(27);
    expect(parseRepsValue("8-10")).toBe(18);
    expect(parseRepsValue("12")).toBe(12);
    expect(parseRepsValue("")).toBeNull();
  });

  it("detects improving strength trend", () => {
    const result = analyzeTrainingPerformance([
      { exerciseId: "bench", exerciseName: "Supino", date: new Date("2026-05-20"), loadKg: 80, repsDone: "8/8/8", rpe: 8 },
      { exerciseId: "bench", exerciseName: "Supino", date: new Date("2026-05-27"), loadKg: 85, repsDone: "8/8/8", rpe: 8 },
      { exerciseId: "row", exerciseName: "Remada", date: new Date("2026-05-20"), loadKg: 70, repsDone: "10/10/9", rpe: 8 },
      { exerciseId: "row", exerciseName: "Remada", date: new Date("2026-05-27"), loadKg: 70, repsDone: "11/10/10", rpe: 8 },
    ], new Date("2026-05-28"));

    expect(result.trend).toBe("improving");
    expect(result.improvedExercises).toBe(2);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("detects declining strength trend and fatigue alerts", () => {
    const result = analyzeTrainingPerformance([
      { exerciseId: "squat", exerciseName: "Agachamento", date: new Date("2026-05-20"), loadKg: 140, repsDone: "8/8/8", rpe: 8 },
      { exerciseId: "squat", exerciseName: "Agachamento", date: new Date("2026-05-27"), loadKg: 130, repsDone: "7/7/6", rpe: 9 },
      { exerciseId: "pulley", exerciseName: "Pulley", date: new Date("2026-05-20"), loadKg: 80, repsDone: "10/10/10", rpe: 8 },
      { exerciseId: "pulley", exerciseName: "Pulley", date: new Date("2026-05-27"), loadKg: 75, repsDone: "8/8/7", rpe: 9 },
      { exerciseId: "leg", exerciseName: "Leg press", date: new Date("2026-05-27"), loadKg: 200, repsDone: "10/10/10", rpe: 9 },
    ], new Date("2026-05-28"));

    expect(result.trend).toBe("declining");
    expect(result.declinedExercises).toBe(2);
    expect(result.alerts.some((alert) => alert.type === "drop")).toBe(true);
    expect(result.alerts.some((alert) => alert.type === "fatigue")).toBe(true);
  });
});
