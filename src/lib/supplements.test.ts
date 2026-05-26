import { describe, expect, it } from "vitest";
import { estimateSupplementProgress } from "./supplements";

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
});
