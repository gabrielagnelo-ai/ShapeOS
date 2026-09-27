import { describe, expect, it } from "vitest";
import { diaryDate, parseDiaryEntry } from "./diary-input";

describe("diary input", () => {
  it("preserves the selected day and accepts decimal commas", () => {
    const data = new FormData();
    Object.entries({ foodId: "rice", grams: "125,5", mealName: "Almoço", date: "2026-01-10" }).forEach(([key, value]) => data.set(key, value));
    expect(parseDiaryEntry(data)).toMatchObject({ foodId: "rice", grams: 125.5, date: new Date("2026-01-10T03:00:00Z") });
    data.delete("foodId"); data.set("foodQuery", "arroz");
    expect(parseDiaryEntry(data)).toHaveProperty("error");
  });
  it("rejects future and impossible dates", () => {
    expect(diaryDate("2026-02-30", "2026-03-01")).toBeNull();
    expect(diaryDate("2026-03-02", "2026-03-01")).toBeNull();
    expect(diaryDate("2026-03-01", "2026-03-01")).not.toBeNull();
  });
  it("rejects invalid quantities and meals", () => {
    const data = new FormData();
    Object.entries({ foodId: "rice", grams: "NaN", mealName: "Almoço", date: "2026-01-10" }).forEach(([key, value]) => data.set(key, value));
    for (const grams of ["NaN", "Infinity", "-20", "0", "10001"]) { data.set("grams", grams); expect(parseDiaryEntry(data)).toHaveProperty("error"); }
    data.set("grams", "100"); data.set("mealName", "invalid");
    expect(parseDiaryEntry(data)).toHaveProperty("error");
  });
});
