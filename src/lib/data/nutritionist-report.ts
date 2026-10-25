import type { Profile } from "@prisma/client";
import { bodyStateFromLatestSnapshot, recalculateBodyCompositionSnapshots } from "@/lib/body-composition";
import { buildBodyCompositionProjection } from "@/lib/bodyCompositionEngine";
import { endOfTodayInAppTimeZone, startOfTodayInAppTimeZone } from "@/lib/date-time";
import { sumNutrients, toFoodNutrients } from "@/lib/nutrition";
import { calendarPeriods, foodPeriodSummary, proteinHitRate, waterPeriodSummary } from "@/lib/period-averages";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics } from "@/lib/profile-metrics";
import { effectiveTdee, validateTdeeTrend } from "@/lib/tdee";
import { analyzeTrainingPerformance, trainingLogsFromPlans } from "@/lib/training-performance";
import { waterTargetMl } from "@/lib/water";

/** Everything the nutritionist report reads from the database for one user, fetched in parallel. */
export async function fetchReportRecords(userId: string, now = new Date()) {
  const periods = calendarPeriods(now);
  const since = new Date(now);
  since.setDate(since.getDate() - 30);

  const [rawBodySnapshots, checkins, foodLogs, activePlan, activities, waterLogs, healthSummaries, supplementPlans, trainingPlan, trainingPlansForPerformance] = await Promise.all([
    prisma.bodyCompositionSnapshot.findMany({ where: { userId }, orderBy: { measuredAt: "desc" }, take: 12 }),
    prisma.weeklyCheckin.findMany({
      where: { userId },
      include: { bodyPhotos: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } },
      orderBy: { weekStart: "desc" },
      take: 12,
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
    prisma.physicalActivityLog.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "desc" }, take: 60 }),
    prisma.waterLog.findMany({ where: { userId, date: { gte: periods.semester.start, lt: periods.semester.end } }, orderBy: { date: "desc" } }),
    prisma.healthDailySummary.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "desc" }, take: 30 }),
    prisma.supplementPlan.findMany({
      where: { userId },
      include: { logs: { orderBy: { date: "desc" }, take: 10 }, periods: { orderBy: { startDate: "desc" }, take: 5 } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.trainingPlan.findFirst({
      where: { userId, isActive: true },
      include: {
        days: {
          orderBy: { order: "asc" },
          include: { exercises: { orderBy: { order: "asc" }, include: { logs: { where: { userId }, orderBy: { date: "desc" }, take: 4 } } } },
        },
      },
    }),
    prisma.trainingPlan.findMany({
      where: { userId },
      include: {
        days: {
          include: { exercises: { include: { logs: { where: { userId }, orderBy: { date: "desc" }, take: 4 } } } },
        },
      },
      take: 12,
    }),
  ]);

  return { periods, rawBodySnapshots, checkins, foodLogs, activePlan, activities, waterLogs, healthSummaries, supplementPlans, trainingPlan, trainingPlansForPerformance };
}

export type ReportRecords = Awaited<ReturnType<typeof fetchReportRecords>>;

/** What the report shows, computed from the records. Pure: no database, same result for the same `now`. */
export function buildNutritionistReport(profile: Profile, records: ReportRecords, now = new Date()) {
  const { rawBodySnapshots, checkins, foodLogs, activePlan, activities, waterLogs, trainingPlansForPerformance } = records;
  const periods = records.periods ?? calendarPeriods(now);
  const baseMetrics = computeProfileMetrics(profile);
  const bodySnapshots = recalculateBodyCompositionSnapshots(rawBodySnapshots, { sex: baseMetrics.sex, heightCm: profile.heightCm });
  const latestBody = bodySnapshots[0];
  const currentBody = bodyStateFromLatestSnapshot(profile, bodySnapshots);
  const metrics = computeProfileMetrics(profile, currentBody);
  const foodLogsForPeriod = foodLogs.map((log) => ({
    date: log.date,
    items: log.items.map((item) => ({ food: toFoodNutrients(item.food), grams: item.grams })),
  }));
  const foodMonth = foodPeriodSummary(foodLogsForPeriod, periods.month);
  const todayStart = startOfTodayInAppTimeZone(now);
  const todayEnd = endOfTodayInAppTimeZone(now);
  const todayActivities = activities.filter((activity) => activity.date >= todayStart && activity.date <= todayEnd);
  const checkinsOldestFirst = [...checkins].reverse();
  const activitiesTotals = {
    raw: Math.round(activities.reduce((sum, item) => sum + item.caloriesKcal, 0)),
    conservative: Math.round(activities.reduce((sum, item) => sum + (item.conservativeCaloriesKcal ?? item.caloriesKcal), 0)),
    todayConservative: Math.round(todayActivities.reduce((sum, item) => sum + (item.conservativeCaloriesKcal ?? item.caloriesKcal), 0)),
  };

  return {
    ...records,
    periods,
    metrics,
    bodySnapshots,
    currentBody,
    foodMonth,
    foodQuarter: foodPeriodSummary(foodLogsForPeriod, periods.quarter),
    foodSemester: foodPeriodSummary(foodLogsForPeriod, periods.semester),
    planTotals: activePlan ? sumNutrients(activePlan.meals.flatMap((meal) => meal.items.map((item) => ({ food: toFoodNutrients(item.food), grams: item.grams })))) : null,
    todayActivities,
    tdeeResult: effectiveTdee({
      bmr: metrics.bmr,
      activityFactor: profile.activityFactor,
      adjustmentKcal: profile.tdeeAdjustmentKcal,
      mode: profile.tdeeCalculationMode,
      activities: todayActivities,
    }),
    tdeeValidation: validateTdeeTrend({
      tdee: metrics.tdee,
      averageIntakeKcal: Math.round(foodMonth.average.kcal),
      checkins: checkinsOldestFirst,
    }),
    bodyComposition: buildBodyCompositionProjection({
      currentWeightKg: currentBody.weightKg,
      currentWaistCm: currentBody.waistCm,
      currentBodyFatPct: latestBody?.bodyFatPct ?? metrics.bodyFat.percentage,
      targetBodyFatPct: profile.targetBodyFatPct,
      targetWaistCm: profile.targetWaistCm,
      targetDate: profile.targetDate,
      checkins: checkinsOldestFirst,
      snapshots: bodySnapshots,
      proteinHitRate: proteinHitRate(foodMonth.dayTotals, metrics.targets.proteinG),
      deficitPct: metrics.tdee ? Math.round(((metrics.tdee - metrics.targets.calories) / metrics.tdee) * 100) : null,
    }),
    waterTarget: waterTargetMl(currentBody.weightKg, profile.waterPreference),
    todayWaterMl: waterLogs.filter((log) => log.date >= todayStart && log.date <= todayEnd).reduce((sum, log) => sum + log.amountMl, 0),
    waterMonth: waterPeriodSummary(waterLogs, periods.month),
    waterQuarter: waterPeriodSummary(waterLogs, periods.quarter),
    waterSemester: waterPeriodSummary(waterLogs, periods.semester),
    activitiesTotals,
    averageConservativeActivityKcal: Math.round(activitiesTotals.conservative / 30),
    trainingPerformance: analyzeTrainingPerformance(trainingLogsFromPlans(trainingPlansForPerformance)),
  };
}

export type NutritionistReport = ReturnType<typeof buildNutritionistReport>;

/** The report's data for the signed-in user: fetch, then compute. */
export async function loadNutritionistReport(userId: string, profile: Profile, now = new Date()) {
  return buildNutritionistReport(profile, await fetchReportRecords(userId, now), now);
}
