import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@prisma/client";
import { waterTargetMl } from "@/lib/water";

const mocks = vi.hoisted(() => ({
  database: {
    foodLog: { findFirst: vi.fn(), findMany: vi.fn() },
    weeklyCheckin: { findMany: vi.fn() },
    dietPlan: { findFirst: vi.fn() },
    bodyCompositionSnapshot: { findMany: vi.fn() },
    waterLog: { findMany: vi.fn() },
    trainingPlan: { findMany: vi.fn() },
    healthDailySummary: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.database }));

import { buildTodayView, fetchTodayRecords, type TodayRecords } from "./today";

// 23 Oct 2026, 20:30 in São Paulo.
const now = new Date("2026-10-23T23:30:00.000Z");
const yesterday = new Date("2026-10-22T15:00:00.000Z");

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

const rice = { name: "Arroz branco cozido", kcalPer100g: 128, proteinPer100g: 2.5, carbsPer100g: 28.1, fatPer100g: 0.2, fiberPer100g: 1.6, sodiumPer100g: 1 };

function records(overrides: Partial<Record<keyof TodayRecords, unknown>> = {}) {
  return {
    periods: undefined,
    todayLog: null,
    weeklyCheckins: [],
    recentFoodLogs: [],
    periodFoodLogs: [],
    activePlan: null,
    rawBodySnapshots: [],
    waterLogs: [],
    trainingPlans: [],
    healthDays: [],
    ...overrides,
  } as unknown as TodayRecords;
}

const plan = { meals: [{ name: "Almoço", order: 1, items: [{ grams: 150, food: rice }] }] };
const todayLog = { date: now, items: [{ mealName: "Almoço", grams: 200, food: rice }] };

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  for (const model of Object.values(mocks.database)) {
    for (const query of Object.values(model)) query.mockResolvedValue([]);
  }
  mocks.database.foodLog.findFirst.mockResolvedValue(null);
  mocks.database.dietPlan.findFirst.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchTodayRecords", () => {
  it("scopes every query to the signed-in user", async () => {
    await fetchTodayRecords("user-1", now);
    const calls = Object.values(mocks.database).flatMap((model) => Object.values(model).flatMap((query) => query.mock.calls));
    expect(calls).toHaveLength(9);
    for (const [args] of calls) expect(args.where.userId).toBe("user-1");
    const trainingArgs = mocks.database.trainingPlan.findMany.mock.calls[0][0];
    expect(trainingArgs.include.days.include.exercises.include.logs.where).toEqual({ userId: "user-1" });
  });

  it("starts all queries before waiting for any of them", async () => {
    let release!: () => void;
    mocks.database.foodLog.findFirst.mockReturnValue(new Promise((resolve) => { release = () => resolve(null); }));
    const pending = fetchTodayRecords("user-1", now);
    await Promise.resolve();
    expect(mocks.database.healthDailySummary.findMany).toHaveBeenCalled();
    release();
    await pending;
  });

  it("returns the weekly check-ins oldest first", async () => {
    mocks.database.weeklyCheckin.findMany.mockResolvedValue([{ id: "new" }, { id: "old" }]);
    const result = await fetchTodayRecords("user-1", now);
    expect(result.weeklyCheckins.map((checkin) => checkin.id)).toEqual(["old", "new"]);
  });
});

describe("buildTodayView", () => {
  it("asks for a diet plan first, with the full targets still to go", () => {
    const view = buildTodayView({ userName: "Gabriel Agnelo", profile, records: records(), now });
    expect(view.targets).toMatchObject({ calories: 2359, proteinG: 144, fatG: 64, carbsG: 302 });
    expect(view.consumed.kcal).toBe(0);
    expect(view.remainingCalories).toBe(2359);
    expect(view.hasLoggedToday).toBe(false);
    expect(view.nextStep.kind).toBe("create-plan");
    expect(view.todayMeals).toEqual([]);
  });

  it("asks to log a meal once there is a plan", () => {
    const view = buildTodayView({ userName: "Gabriel", profile, records: records({ activePlan: plan }), now });
    expect(view.nextStep.kind).toBe("log-meal");
    expect(view.todayMeals).toEqual([{ name: "Almoço", kcal: 192, status: "planned" }]);
  });

  it("counts what was eaten today and asks for the weekly check-in next", () => {
    const view = buildTodayView({ userName: "Gabriel", profile, records: records({ activePlan: plan, todayLog }), now });
    expect(view.consumed.kcal).toBe(256);
    expect(view.remainingCalories).toBe(2103);
    expect(view.remainingProtein).toBe(139);
    expect(view.hasLoggedToday).toBe(true);
    expect(view.todayMeals).toEqual([{ name: "Almoço", kcal: 256, status: "logged" }]);
    expect(view.nextStep.kind).toBe("checkin");
  });

  it("adds only today's water to the day's total", () => {
    const waterLogs = [{ date: now, amountMl: 500 }, { date: yesterday, amountMl: 1000 }];
    const view = buildTodayView({ userName: "Gabriel", profile, records: records({ waterLogs }), now });
    expect(view.water.consumedMl).toBe(500);
    expect(view.water.targetMl).toBe(waterTargetMl(80, "medium"));
  });

  it("greets by the hour in São Paulo", () => {
    const view = buildTodayView({ userName: "Gabriel Agnelo", profile, records: records(), now });
    expect(view.greeting).toBe("Boa noite, Gabriel");
    expect(view.dateLabel).toBe("sexta-feira, 23 de outubro");
  });
});
