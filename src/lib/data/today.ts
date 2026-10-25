import type { Profile } from "@prisma/client";
import { bodyStateFromLatestSnapshot, recalculateBodyCompositionSnapshots } from "@/lib/body-composition";
import { buildBodyTimeline } from "@/lib/body-progress";
import { buildBodyCompositionProjection } from "@/lib/bodyCompositionEngine";
import { generateCoachInsights } from "@/lib/coach";
import { buildCoachContext, hasEnoughCoachData } from "@/lib/coach/context";
import { APP_TIME_ZONE, endOfTodayInAppTimeZone, startOfTodayInAppTimeZone } from "@/lib/date-time";
import { mealOrder } from "@/lib/meals";
import { nutrientsForGrams, sumNutrients, toFoodNutrients } from "@/lib/nutrition";
import { calendarPeriods, foodPeriodSummary, proteinHitRate, waterPeriodSummary } from "@/lib/period-averages";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics } from "@/lib/profile-metrics";
import { estimateBodyEnergy, nextTrainingDay, summarizeSleep, summarizeTodayMeals, trainingWeek } from "@/lib/today";
import { analyzeTrainingPerformance, trainingLogsFromPlans } from "@/lib/training-performance";
import { waterTargetMl } from "@/lib/water";

/** Everything Hoje reads from the database for one user, fetched in parallel. */
export async function fetchTodayRecords(userId: string, now = new Date()) {
  const periods = calendarPeriods(now);
  const todayStart = startOfTodayInAppTimeZone(now);
  const todayEnd = endOfTodayInAppTimeZone(now);
  const [todayLog, recentCheckins, recentFoodLogs, periodFoodLogs, activePlan, rawBodySnapshots, waterLogs, trainingPlans, healthDays] = await Promise.all([
    prisma.foodLog.findFirst({
      where: { userId, date: { gte: todayStart, lte: todayEnd } },
      include: { items: { include: { food: true } } },
    }),
    prisma.weeklyCheckin.findMany({ where: { userId }, orderBy: { weekStart: "desc" }, take: 8 }),
    prisma.foodLog.findMany({
      where: { userId },
      include: { items: { include: { food: true } } },
      orderBy: { date: "desc" },
      take: 7,
    }),
    prisma.foodLog.findMany({
      where: { userId, date: { gte: periods.semester.start, lt: periods.semester.end } },
      include: { items: { include: { food: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.dietPlan.findFirst({
      where: { userId, isActive: true },
      include: { meals: { include: { items: { include: { food: true, recipe: { select: { id: true, name: true } } } } }, orderBy: { order: "asc" } } },
    }),
    prisma.bodyCompositionSnapshot.findMany({
      where: { userId },
      orderBy: { measuredAt: "desc" },
      take: 30, // the 3D model compares up to 90 days; the targets use the 12 most recent
    }),
    prisma.waterLog.findMany({
      where: { userId, date: { gte: periods.semester.start, lt: periods.semester.end } },
      select: { date: true, amountMl: true },
    }),
    prisma.trainingPlan.findMany({
      where: { userId },
      include: {
        days: {
          include: {
            exercises: {
              include: { logs: { where: { userId }, orderBy: { date: "desc" }, take: 4 } },
            },
          },
        },
      },
      take: 12,
    }),
    prisma.healthDailySummary.findMany({
      where: { userId, date: { gte: new Date(todayStart.getTime() - 8 * 86400000) } },
      orderBy: { date: "asc" },
    }),
  ]);

  return {
    periods,
    todayLog,
    weeklyCheckins: [...recentCheckins].reverse(),
    recentFoodLogs,
    periodFoodLogs,
    activePlan,
    rawBodySnapshots,
    waterLogs,
    trainingPlans,
    healthDays,
  };
}

export type TodayRecords = Awaited<ReturnType<typeof fetchTodayRecords>>;

/** The one thing Hoje asks the user to do next, in this order of priority. */
export type TodayNextStep =
  | { kind: "create-plan" }
  | { kind: "log-meal" }
  | { kind: "checkin" }
  | { kind: "coach"; message: string }
  | { kind: "keep-going" };

/** What Hoje shows, computed from the records. Pure: no database, same result for the same `now`. */
export function buildTodayView({ userName, profile, records, now = new Date() }: {
  userName: string;
  profile: Profile;
  records: TodayRecords;
  now?: Date;
}) {
  const { todayLog, weeklyCheckins, recentFoodLogs, periodFoodLogs, activePlan, rawBodySnapshots, waterLogs, trainingPlans, healthDays } = records;
  const periods = records.periods ?? calendarPeriods(now);
  const todayStart = startOfTodayInAppTimeZone(now);
  const todayEnd = endOfTodayInAppTimeZone(now);
  const activePlanMeals = activePlan ? sortMeals(activePlan.meals) : [];

  const metricsWithoutBody = computeProfileMetrics(profile);
  const allBodySnapshots = recalculateBodyCompositionSnapshots(rawBodySnapshots, { sex: metricsWithoutBody.sex, heightCm: profile.heightCm });
  const bodySnapshots = allBodySnapshots.slice(0, 12);
  const latestBody = bodySnapshots[0];
  const currentBody = bodyStateFromLatestSnapshot(profile, bodySnapshots);
  const bodyTimeline = buildBodyTimeline(profile, allBodySnapshots);
  const { sex, goal, tdee, targets, micronutrientTargets } = computeProfileMetrics(profile, currentBody);

  const water = {
    consumedMl: waterLogs.filter((log) => log.date >= todayStart && log.date <= todayEnd).reduce((total, log) => total + log.amountMl, 0),
    targetMl: waterTargetMl(currentBody.weightKg, profile.waterPreference),
    month: waterPeriodSummary(waterLogs, periods.month),
    quarter: waterPeriodSummary(waterLogs, periods.quarter),
    semester: waterPeriodSummary(waterLogs, periods.semester),
  };
  const foodMonth = foodPeriodSummary(periodFoodLogs.map((log) => ({
    date: log.date,
    items: log.items.map((item) => ({ grams: item.grams, food: toFoodNutrients(item.food) })),
  })), periods.month);
  const consumed = sumNutrients(todayLog?.items.map((item) => ({ grams: item.grams, food: toFoodNutrients(item.food) })) ?? []);
  const hasLoggedToday = Boolean(todayLog?.items.length);
  const lowMicronutrients = [
    consumed.calciumMg < micronutrientTargets.calciumMg * 0.5 ? "cálcio" : null,
    consumed.ironMg < micronutrientTargets.ironMg * 0.5 ? "ferro" : null,
    consumed.magnesiumMg < micronutrientTargets.magnesiumMg * 0.5 ? "magnésio" : null,
    consumed.potassiumMg < micronutrientTargets.potassiumMg * 0.5 ? "potássio" : null,
  ].filter(Boolean) as string[];

  const coachContext = buildCoachContext({
    goal,
    tdee,
    targetCalories: targets.calories,
    proteinTargetG: targets.proteinG,
    foodLogs: recentFoodLogs,
    checkins: weeklyCheckins,
    lowMicronutrients: hasLoggedToday ? lowMicronutrients : [],
  });
  const insights = hasEnoughCoachData(coachContext) ? generateCoachInsights(coachContext) : [];
  const bodyComposition = buildBodyCompositionProjection({
    currentWeightKg: currentBody.weightKg,
    currentWaistCm: currentBody.waistCm,
    currentBodyFatPct: latestBody?.bodyFatPct,
    targetWaistCm: profile.targetWaistCm,
    targetBodyFatPct: profile.targetBodyFatPct,
    targetDate: profile.targetDate,
    checkins: weeklyCheckins,
    snapshots: bodySnapshots,
    proteinHitRate: proteinHitRate(foodMonth.dayTotals, targets.proteinG),
    deficitPct: goal === "fat_loss" && tdee ? Math.round(((tdee - targets.calories) / tdee) * 100) : 0,
  });
  const nextStep: TodayNextStep = !activePlan
    ? { kind: "create-plan" }
    : !hasLoggedToday
      ? { kind: "log-meal" }
      : !weeklyCheckins.length
        ? { kind: "checkin" }
        : insights.length
          ? { kind: "coach", message: insights[0].message }
          : { kind: "keep-going" };

  const hour = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(now));
  const activeTrainingPlan = trainingPlans.find((plan) => plan.isActive) ?? trainingPlans[0];

  return {
    sex,
    periods,
    currentBody,
    bodyTimeline,
    targets,
    consumed,
    hasLoggedToday,
    remainingCalories: Math.max(0, Math.round(targets.calories - consumed.kcal)),
    remainingProtein: Math.max(0, Math.round(targets.proteinG - consumed.proteinG)),
    water,
    insights,
    bodyComposition,
    nextStep,
    greeting: `${hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"}, ${userName.split(" ")[0]}`,
    dateLabel: new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(now),
    todayMeals: summarizeTodayMeals(
      (todayLog?.items ?? []).map((item) => ({ mealName: item.mealName, kcal: nutrientsForGrams(toFoodNutrients(item.food), item.grams).kcal })),
      activePlanMeals.map((meal) => ({ name: meal.name, kcal: meal.items.reduce((sum, item) => sum + nutrientsForGrams(toFoodNutrients(item.food), item.grams).kcal, 0) })),
    ),
    nextTraining: activeTrainingPlan ? nextTrainingDay(activeTrainingPlan.days) : null,
    week: trainingWeek(trainingPlans.flatMap((plan) => plan.days.flatMap((day) => day.exercises.flatMap((exercise) => exercise.logs.map((log) => log.date)))), now),
    trainingPerformance: analyzeTrainingPerformance(trainingLogsFromPlans(trainingPlans)),
    sleep: summarizeSleep(healthDays),
    energy: estimateBodyEnergy(healthDays),
    weeklyCheckins,
    lastCheckin: weeklyCheckins[weeklyCheckins.length - 1],
  };
}

export type TodayView = ReturnType<typeof buildTodayView>;

/** Hoje's data for the signed-in user: fetch, then compute. */
export async function loadToday(user: { id: string; name: string }, profile: Profile, now = new Date()) {
  return buildTodayView({ userName: user.name, profile, records: await fetchTodayRecords(user.id, now), now });
}

function sortMeals<T extends { name: string; order: number }>(meals: T[]) {
  return [...meals].sort((a, b) => mealOrder(a.name) - mealOrder(b.name) || a.order - b.order);
}
