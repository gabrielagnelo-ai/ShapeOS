import { describe, expect, it } from "vitest";
import { estimateSupplementProgress, sumSupplementMicronutrients } from "./supplements";

describe("estimateSupplementProgress", () => {
  it("estimates creatine loading as complete around 100g", () => {
    const result = estimateSupplementProgress({
      type: "CREATINE",
      protocol: "LOADING",
      dailyDoseG: 20,
      startedAt: new Date("2026-05-01"),
      now: new Date("2026-05-05"),
      logs: Array.from({ length: 5 }, (_, index) => ({
        date: new Date(`2026-05-0${index + 1}`),
        doseG: 20,
      })),
    });

    expect(result.percent).toBe(100);
    expect(result.status).toBe("saturado estimado");
  });

  it("estimates beta-alanine adaptation over cumulative daily use", () => {
    const result = estimateSupplementProgress({
      type: "BETA_ALANINE",
      protocol: "STEADY",
      dailyDoseG: 4,
      startedAt: new Date("2026-05-01"),
      now: new Date("2026-05-14"),
      logs: [],
    });

    expect(result.percent).toBe(50);
    expect(result.status).toBe("acumulando");
  });

  it("counts imported usage periods with estimated adherence", () => {
    const result = estimateSupplementProgress({
      type: "CREATINE",
      protocol: "STEADY",
      dailyDoseG: 5,
      startedAt: new Date("2026-05-01"),
      now: new Date("2026-05-20"),
      logs: [],
      periods: [{
        startDate: new Date("2026-05-01"),
        endDate: new Date("2026-05-20"),
        dailyDoseG: 5,
        adherencePct: 80,
      }],
    });

    expect(result.periodDoseG).toBe(80);
    expect(result.totalDoseG).toBe(80);
    expect(result.percent).toBe(57);
  });

  it("counts multivitamin nutrients only from registered doses", () => {
    const result = sumSupplementMicronutrients([{
      micronutrientsPerDose: { vitaminCMg: 45, zincMg: 7 },
      logs: [{ doseG: 1 }, { doseG: 0.5 }],
    }]);

    expect(result.vitaminCMg).toBe(67.5);
    expect(result.zincMg).toBe(10.5);
    expect(result.calciumMg).toBe(0);
  });

  it("does not infer multivitamin doses that were not logged", () => {
    const result = estimateSupplementProgress({
      type: "MULTIVITAMIN",
      protocol: "STEADY",
      dailyDoseG: 1,
      startedAt: new Date("2026-07-01"),
      now: new Date("2026-07-10"),
      logs: [],
    });

    expect(result.percent).toBe(0);
    expect(result.adherencePct).toBe(0);
  });
});
