import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  database: {
    bodyCompositionSnapshot: { findMany: vi.fn() },
    weeklyCheckin: { findMany: vi.fn() },
    foodLog: { findMany: vi.fn() },
    dietPlan: { findFirst: vi.fn() },
    physicalActivityLog: { findMany: vi.fn() },
    waterLog: { findMany: vi.fn() },
    healthDailySummary: { findMany: vi.fn() },
    supplementPlan: { findMany: vi.fn() },
    trainingPlan: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.database }));

import { buildNutritionistReport, fetchReportRecords, type ReportRecords } from "./nutritionist-report";

const now = new Date("2026-10-23T18:00:00.000Z");
const today = new Date("2026-10-23T14:00:00.000Z");
const fiveDaysAgo = new Date("2026-10-18T14:00:00.000Z");

const profile = {
  sex: "MALE",
  goal: "FAT_LOSS",
  age: 30,
  heightCm: 180,
  weightKg: 80,
  neckCm: 38,
  waistCm: 86,
  hipCm: null,
  activityFactor: 1.55,
  tdeeAdjustmentKcal: 0,
  tdeeCalculationMode: "COEFFICIENT",
  calorieDeficitKcal: 400,
  proteinPerKg: 1.8,
  fatPerKg: 0.8,
  fiberTargetG: null,
  sodiumLimitMg: null,
  calciumTargetMg: null,
  ironTargetMg: null,
  magnesiumTargetMg: null,
  potassiumTargetMg: null,
  zincTargetMg: null,
  vitaminCTargetMg: null,
  vitaminDTargetMcg: null,
  vitaminB12TargetMcg: null,
  waterPreference: "medium",
  targetWaistCm: null,
  targetBodyFatPct: null,
  targetDate: null,
} as unknown as Profile;

const rice = { name: "Arroz branco cozido", kcalPer100g: 128, proteinPer100g: 2.5, carbsPer100g: 28.1, fatPer100g: 0.2 };

function records(overrides: Partial<Record<keyof ReportRecords, unknown>> = {}) {
  return {
    periods: undefined,
    rawBodySnapshots: [],
    checkins: [],
    foodLogs: [],
    activePlan: null,
    activities: [],
    waterLogs: [],
    healthSummaries: [],
    supplementPlans: [],
    trainingPlan: null,
    trainingPlansForPerformance: [],
    ...overrides,
  } as unknown as ReportRecords;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  for (const model of Object.values(mocks.database)) {
    for (const query of Object.values(model)) query.mockResolvedValue([]);
  }
  mocks.database.dietPlan.findFirst.mockResolvedValue(null);
  mocks.database.trainingPlan.findFirst.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchReportRecords", () => {
  it("scopes every query to the signed-in user", async () => {
    await fetchReportRecords("user-1", now);
    const calls = Object.values(mocks.database).flatMap((model) => Object.values(model).flatMap((query) => query.mock.calls));
    expect(calls).toHaveLength(10);
    for (const [args] of calls) expect(args.where.userId).toBe("user-1");
    for (const query of [mocks.database.trainingPlan.findFirst, mocks.database.trainingPlan.findMany]) {
      expect(query.mock.calls[0][0].include.days.include.exercises.include.logs.where).toEqual({ userId: "user-1" });
    }
  });
});

describe("buildNutritionistReport", () => {
  it("recomputes the targets with the latest body measurement", () => {
    const rawBodySnapshots = [{ measuredAt: today, weightKg: 90, neckCm: 38, waistCm: 86, hipCm: null }];
    const report = buildNutritionistReport(profile, records({ rawBodySnapshots }), now);
    expect(report.currentBody.weightKg).toBe(90);
    expect(report.metrics.targets).toMatchObject({ calories: 2514, proteinG: 162 });
  });

  it("totals activity of the last 30 days and of today, counting the conservative estimate", () => {
    const activities = [
      { date: today, caloriesKcal: 250, conservativeCaloriesKcal: 200, countsTowardTdee: true },
      { date: fiveDaysAgo, caloriesKcal: 300, conservativeCaloriesKcal: null, countsTowardTdee: true },
    ];
    const report = buildNutritionistReport(profile, records({ activities }), now);
    expect(report.activitiesTotals).toEqual({ raw: 550, conservative: 500, todayConservative: 200 });
    expect(report.averageConservativeActivityKcal).toBe(17);
    expect(report.todayActivities).toHaveLength(1);
  });

  it("adds only today's water and totals the active plan", () => {
    const waterLogs = [{ date: today, amountMl: 500 }, { date: fiveDaysAgo, amountMl: 1000 }];
    const activePlan = { meals: [{ items: [{ grams: 150, food: rice }] }] };
    const report = buildNutritionistReport(profile, records({ waterLogs, activePlan }), now);
    expect(report.todayWaterMl).toBe(500);
    expect(report.planTotals?.kcal).toBe(192);
  });
});
