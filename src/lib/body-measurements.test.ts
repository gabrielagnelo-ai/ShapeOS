import { describe, expect, it } from "vitest";
import { circumferenceLabel, latestCircumferences, parseCircumferences } from "./body-measurements";

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([name, value]) => data.set(name, value));
  return data;
}

describe("body measurements", () => {
  it("parses Brazilian decimals and treats empty fields as not informed", () => {
    expect(parseCircumferences(form({ chestCm: "102,5", armCm: "36", thighCm: "", calfCm: " " }))).toEqual({
      chestCm: 102.5,
      armCm: 36,
      thighCm: null,
      calfCm: null,
    });
  });

  it("ignores implausible values instead of saving them", () => {
    expect(parseCircumferences(form({ chestCm: "10", armCm: "texto", thighCm: "500", calfCm: "38" }))).toEqual({
      chestCm: null,
      armCm: null,
      thighCm: null,
      calfCm: 38,
    });
  });

  it("keeps the latest known value of each measurement", () => {
    const profile = { chestCm: 100, armCm: 35, thighCm: 57, calfCm: null };
    const snapshots = [
      { chestCm: 102, armCm: null, thighCm: null, calfCm: null },
      { chestCm: 101, armCm: 36.5, thighCm: null, calfCm: null },
    ];
    expect(latestCircumferences(profile, snapshots)).toEqual({ chestCm: 102, armCm: 36.5, thighCm: 57, calfCm: null });
  });

  it("names the chest measurement by sex", () => {
    expect(circumferenceLabel("chestCm", "male")).toBe("Peito");
    expect(circumferenceLabel("chestCm", "female")).toBe("Busto");
  });
});
