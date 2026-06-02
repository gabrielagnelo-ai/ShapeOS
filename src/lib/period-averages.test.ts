import { describe, expect, it } from "vitest";
import { parseAppDate } from "./date-time";
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
    const periods = calendarPeriods(new Date("2026-05-30T15:00:00.000Z"));
    const summary = foodPeriodSummary([
      { date: parseAppDate("2026-05-02")!, items: [{ food, grams: 100 }] },
      { date: parseAppDate("2026-05-10")!, items: [{ food, grams: 300 }] },
      { date: parseAppDate("2026-04-30")!, items: [{ food, grams: 1000 }] },
      { date: parseAppDate("2026-05-15")!, items: [] },
    ], periods.month);

    expect(summary.registeredDays).toBe(2);
    expect(summary.average.kcal).toBe(200);
    expect(summary.average.proteinG).toBe(4);
  });

  it("resets the monthly window when the month changes", () => {
    const may = calendarPeriods(new Date("2026-05-30T15:00:00.000Z")).month;
    const june = calendarPeriods(new Date("2026-06-01T15:00:00.000Z")).month;

    expect(may.start).toEqual(parseAppDate("2026-05-01"));
    expect(may.end).toEqual(parseAppDate("2026-06-01"));
    expect(june.start).toEqual(parseAppDate("2026-06-01"));
    expect(june.end).toEqual(parseAppDate("2026-07-01"));
  });

  it("averages water only across days with water logs", () => {
    const periods = calendarPeriods(new Date("2026-05-30T15:00:00.000Z"));
    const summary = waterPeriodSummary([
      { date: new Date("2026-05-01T12:00:00.000Z"), amountMl: 500 },
      { date: new Date("2026-05-01T16:00:00.000Z"), amountMl: 750 },
      { date: parseAppDate("2026-05-20")!, amountMl: 2500 },
      { date: parseAppDate("2026-04-20")!, amountMl: 9999 },
    ], periods.month);

    expect(summary.registeredDays).toBe(2);
    expect(summary.averageMl).toBe(1875);
    expect(summary.totalMl).toBe(3750);
  });
});
