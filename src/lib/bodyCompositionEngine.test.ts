import { describe, expect, it } from "vitest";
import { buildBodyCompositionProjection, estimateLeanMass, projectedWeightByBodyFat } from "./bodyCompositionEngine";

describe("body composition engine", () => {
  it("calcula massa magra e peso projetado por BF alvo", () => {
    expect(estimateLeanMass(117, 26)).toBe(86.6);
    expect(projectedWeightByBodyFat(86.6, 15)).toBe(101.9);
    expect(projectedWeightByBodyFat(86.6, 12)).toBe(98.4);
  });

  it("gera cenários conservador, realista e agressivo por composição corporal", () => {
    const projection = buildBodyCompositionProjection({
      currentWeightKg: 117,
      currentWaistCm: 106,
      currentBodyFatPct: 26,
      targetBodyFatPct: 15,
      checkins: [],
      snapshots: [],
      proteinHitRate: 0.9,
      deficitPct: 18,
    });

    expect(projection.targetWeightKg).toBe(101.9);
    expect(projection.scenarios).toHaveLength(3);
    expect(projection.scenarios.map((scenario) => scenario.key)).toEqual(["conservative", "realistic", "aggressive"]);
    expect(projection.scenarios[2].estimatedWeeks).toBeLessThan(projection.scenarios[0].estimatedWeeks ?? 999);
  });

  it("detecta recomposição quando cintura e BF caem com peso estável", () => {
    const projection = buildBodyCompositionProjection({
      currentWeightKg: 117,
      currentWaistCm: 104,
      currentBodyFatPct: 25,
      targetBodyFatPct: 15,
      checkins: [
        { averageWeightKg: 117.2, waistCm: 106.5, trainingDone: true, weekStart: new Date("2026-05-01") },
        { averageWeightKg: 117.0, waistCm: 104.8, trainingDone: true, weekStart: new Date("2026-05-15") },
      ],
      snapshots: [
        { measuredAt: new Date("2026-05-01"), weightKg: 117.2, waistCm: 106.5, bodyFatPct: 26.2, leanMassKg: 86.5 },
        { measuredAt: new Date("2026-05-15"), weightKg: 117.0, waistCm: 104.8, bodyFatPct: 25.4, leanMassKg: 87.3 },
      ],
      proteinHitRate: 0.9,
      deficitPct: 16,
    });

    expect(projection.recomposition.detected).toBe(true);
    expect(projection.primaryMessage).toContain("físico está mudando");
  });

  it("aumenta confiança com histórico de check-ins e snapshots", () => {
    const low = buildBodyCompositionProjection({
      currentWeightKg: 117,
      currentBodyFatPct: 26,
      targetBodyFatPct: 15,
      checkins: [],
      snapshots: [],
    });
    const high = buildBodyCompositionProjection({
      currentWeightKg: 117,
      currentWaistCm: 106,
      currentBodyFatPct: 26,
      targetBodyFatPct: 15,
      checkins: Array.from({ length: 5 }, (_, index) => ({
        averageWeightKg: 117 - index * 0.4,
        waistCm: 106 - index,
        weekStart: new Date(2026, 4, 1 + index * 7),
      })),
      snapshots: Array.from({ length: 4 }, (_, index) => ({
        measuredAt: new Date(2026, 4, 1 + index * 7),
        weightKg: 117 - index * 0.4,
        waistCm: 106 - index,
        bodyFatPct: 26 - index * 0.5,
        leanMassKg: 86.6,
      })),
    });

    expect(high.confidenceScore).toBeGreaterThan(low.confidenceScore);
    expect(high.confidenceLabel).toBe("alta");
  });
});
