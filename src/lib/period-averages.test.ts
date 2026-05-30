import { describe, expect, it } from "vitest";
import { calendarPeriods, foodPeriodSummary, waterPeriodSummary } from "./period-averages";

const food = {
  name: "Arroz",
  kcalPer100g: 100,
  proteinPer100g: 2,
  carbsPer100g: 20,
  fatPer100g: 1,
};

describe("period averages", () => {
  it("uses the current calendar month and only days with food records", () => {
    const periods = calendarPeriods(new Date(2026, 4, 30));
    const summary = foodPeriodSummary([
      { date: new Date(2026, 4, 2), items: [{ food, grams: 100 }] },
      { date: new Date(2026, 4, 10), items: [{ food, grams: 300 }] },
      { date: new Date(2026, 3, 30), items: [{ food, grams: 1000 }] },
      { date: new Date(2026, 4, 15), items: [] },
    ], periods.month);

    expect(summary.registeredDays).toBe(2);
    expect(summary.average.kcal).toBe(200);
    expect(summary.average.proteinG).toBe(4);
  });

  it("resets the monthly window when the month changes", () => {
    const may = calendarPeriods(new Date(2026, 4, 30)).month;
    const june = calendarPeriods(new Date(2026, 5, 1)).month;

    expect(may.start).toEqual(new Date(2026, 4, 1));
    expect(may.end).toEqual(new Date(2026, 5, 1));
    expect(june.start).toEqual(new Date(2026, 5, 1));
    expect(june.end).toEqual(new Date(2026, 6, 1));
  });

  it("averages water only across days with water logs", () => {
    const periods = calendarPeriods(new Date(2026, 4, 30));
    const summary = waterPeriodSummary([
      { date: new Date(2026, 4, 1, 9), amountMl: 500 },
      { date: new Date(2026, 4, 1, 13), amountMl: 750 },
      { date: new Date(2026, 4, 20), amountMl: 2500 },
      { date: new Date(2026, 3, 20), amountMl: 9999 },
    ], periods.month);

    expect(summary.registeredDays).toBe(2);
    expect(summary.averageMl).toBe(1875);
    expect(summary.totalMl).toBe(3750);
  });
});
