import { describe, expect, it } from "vitest";
import { clamp, confidenceLabel, formatNumber, round1 } from "./common";

describe("formatNumber", () => {
  it("writes numbers the Brazilian way with at most one decimal", () => {
    expect(formatNumber(1234.56)).toBe("1.234,6");
    expect(formatNumber(112.73)).toBe("112,7");
    expect(formatNumber(2)).toBe("2");
  });

  it("rounds ties away from zero on both signs", () => {
    expect(formatNumber(0.25)).toBe("0,3");
    expect(formatNumber(-0.25)).toBe("-0,3");
  });
});

describe("round1", () => {
  it("rounds to one decimal", () => {
    expect(round1(2.04)).toBe(2);
    expect(round1(-1.26)).toBe(-1.3);
  });

  it("rounds half up after scaling, unlike toFixed", () => {
    // 0.35 is stored as 0.3499…; toFixed(1) gives 0.3, the screens have always shown 0.4.
    expect(round1(0.35)).toBe(0.4);
  });
});

describe("clamp", () => {
  it("keeps a value inside the range", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(7, 0, 10)).toBe(7);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("passes NaN through, as every copy it replaces did", () => {
    expect(clamp(Number.NaN, 0, 10)).toBeNaN();
  });
});

describe("confidenceLabel", () => {
  it("names the confidence levels whatever their case", () => {
    expect(confidenceLabel("HIGH")).toBe("alta");
    expect(confidenceLabel("medium")).toBe("média");
    expect(confidenceLabel("Low")).toBe("baixa");
    expect(confidenceLabel("media")).toBe("média");
  });

  it("shows an unknown value as it came", () => {
    expect(confidenceLabel("UNKNOWN")).toBe("UNKNOWN");
  });
});
