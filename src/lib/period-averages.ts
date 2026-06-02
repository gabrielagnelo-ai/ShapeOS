import { appDateParts, startOfAppDate } from "./date-time";
import { sumNutrients, type FoodNutrients } from "./nutrition";

export type CalendarPeriod = {
  key: "month" | "quarter" | "semester";
  label: string;
  start: Date;
  end: Date;
};

export type FoodLogForPeriod = {
  date: Date;
  items: Array<{
    grams: number;
    food: FoodNutrients;
  }>;
};

export type WaterLogForPeriod = {
  date: Date;
  amountMl: number;
};

export function calendarPeriods(referenceDate = new Date()) {
  const { year, month } = appDateParts(referenceDate);
  const monthIndex = month - 1;
  const quarterStartMonth = Math.floor(monthIndex / 3) * 3;
  const semesterStartMonth = monthIndex < 6 ? 0 : 6;

  return {
    month: {
      key: "month",
      label: monthLabel(year, month),
      start: startOfAppDate(year, month, 1),
      end: startOfAppDate(year, month + 1, 1),
    },
    quarter: {
      key: "quarter",
      label: `${quarterStartMonth + 1}o-${quarterStartMonth + 3}o mes de ${year}`,
      start: startOfAppDate(year, quarterStartMonth + 1, 1),
      end: startOfAppDate(year, quarterStartMonth + 4, 1),
    },
    semester: {
      key: "semester",
      label: `${semesterStartMonth === 0 ? "1o" : "2o"} semestre de ${year}`,
      start: startOfAppDate(year, semesterStartMonth + 1, 1),
      end: startOfAppDate(year, semesterStartMonth + 7, 1),
    },
  } satisfies Record<CalendarPeriod["key"], CalendarPeriod>;
}

export function foodPeriodSummary(logs: FoodLogForPeriod[], period: CalendarPeriod) {
  const dayTotals = [...logs]
    .filter((log) => isInsidePeriod(log.date, period) && log.items.length > 0)
    .map((log) => ({
      date: log.date,
      totals: sumNutrients(log.items),
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    period,
    registeredDays: dayTotals.length,
    dayTotals,
    average: averageNutrition(dayTotals.map((day) => day.totals)),
  };
}

export function waterPeriodSummary(logs: WaterLogForPeriod[], period: CalendarPeriod) {
  const totalsByDay = logs.reduce((days, log) => {
    if (!isInsidePeriod(log.date, period)) return days;
    const key = dateKey(log.date);
    days.set(key, (days.get(key) ?? 0) + log.amountMl);
    return days;
  }, new Map<string, number>());

  const dayTotals = [...totalsByDay.entries()]
    .map(([key, amountMl]) => ({ key, amountMl }))
    .sort((a, b) => b.key.localeCompare(a.key));

  return {
    period,
    registeredDays: dayTotals.length,
    dayTotals,
    averageMl: Math.round(average(dayTotals.map((day) => day.amountMl))),
    totalMl: dayTotals.reduce((sum, day) => sum + day.amountMl, 0),
  };
}

export function isInsidePeriod(date: Date, period: CalendarPeriod) {
  return date >= period.start && date < period.end;
}

export function dateKey(date: Date) {
  const parts = appDateParts(date);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function averageNutrition(days: ReturnType<typeof sumNutrients>[]) {
  if (!days.length) return sumNutrients([]);
  const totals = days.reduce((acc, day) => ({
    kcal: acc.kcal + day.kcal,
    proteinG: acc.proteinG + day.proteinG,
    carbsG: acc.carbsG + day.carbsG,
    fatG: acc.fatG + day.fatG,
    fiberG: acc.fiberG + day.fiberG,
    sodiumMg: acc.sodiumMg + day.sodiumMg,
    calciumMg: acc.calciumMg + day.calciumMg,
    ironMg: acc.ironMg + day.ironMg,
    magnesiumMg: acc.magnesiumMg + day.magnesiumMg,
    potassiumMg: acc.potassiumMg + day.potassiumMg,
    zincMg: acc.zincMg + day.zincMg,
    vitaminCMg: acc.vitaminCMg + day.vitaminCMg,
    vitaminDMcg: acc.vitaminDMcg + day.vitaminDMcg,
    vitaminB12Mcg: acc.vitaminB12Mcg + day.vitaminB12Mcg,
  }), sumNutrients([]));

  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Number((value / days.length).toFixed(1))])) as ReturnType<typeof sumNutrients>;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
