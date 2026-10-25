import { describe, expect, it } from "vitest";
import { buildBodyTimeline, classifyChange, compareBody } from "./body-progress";

const snapshot = (date: string, values: Record<string, number | null>) => ({ measuredAt: new Date(date), weightKg: 80, bodyFatPct: 20, leanMassKg: 64, ...values });

describe("body progress", () => {
  it("orders the timeline and carries forward missing measurements", () => {
    const timeline = buildBodyTimeline({ chestCm: 98, armCm: 35 }, [
      snapshot("2026-10-20", { waistCm: 84, chestCm: null, armCm: 36 }),
      snapshot("2026-09-20", { waistCm: 88, chestCm: 100 }),
    ]);
    expect(timeline.map((e) => e.date.slice(0, 10))).toEqual(["2026-09-20", "2026-10-20"]);
    expect(timeline[0]).toMatchObject({ waistCm: 88, chestCm: 100, armCm: 35 });
    expect(timeline[1]).toMatchObject({ waistCm: 84, chestCm: 100, armCm: 36 });
  });

  it("classifies changes using the lean-mass trend", () => {
    expect(classifyChange("armCm", 1.2, 0.4)).toBe("muscle");
    expect(classifyChange("waistCm", -3.4, 0.4)).toBe("fat");
    expect(classifyChange("thighCm", -1, -0.5)).toBe("warn");
    expect(classifyChange("hipCm", 1, 0.4)).toBe("warn");
    expect(classifyChange("calfCm", 0.2, 0.4)).toBe("stable");
    expect(classifyChange("chestCm", null, 0.4)).toBe("unknown");
  });

  it("compares with the latest entry at least N days old, or the oldest one", () => {
    const timeline = buildBodyTimeline({}, [
      { ...snapshot("2026-10-20", { waistCm: 84, armCm: 37.5 }), weightKg: 82.4, leanMassKg: 67.2 },
      { ...snapshot("2026-10-13", { waistCm: 85, armCm: 37.4 }), weightKg: 82.9, leanMassKg: 67.1 },
      { ...snapshot("2026-09-20", { waistCm: 87.4, armCm: 36.3 }), weightKg: 84.3, leanMassKg: 66.8 },
    ]);
    const month = compareBody(timeline, 30)!;
    expect(month.days).toBe(30);
    expect(month.deltas.waistCm).toBe(-3.4);
    expect(month.statuses).toMatchObject({ waistCm: "fat", armCm: "muscle" });
    expect(month.weightDelta).toBe(-1.9);
    expect(compareBody(timeline, 90)!.days).toBe(30);
    expect(compareBody(timeline, 7)!.days).toBe(7);
  });

  it("has nothing to compare with a single entry", () => {
    const result = compareBody(buildBodyTimeline({}, [snapshot("2026-10-20", { waistCm: 84 })]), 30)!;
    expect(result.before).toBeNull();
    expect(result.statuses.waistCm).toBe("unknown");
  });
});
