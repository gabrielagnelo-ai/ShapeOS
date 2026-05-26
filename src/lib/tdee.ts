import { activityCategory, conservativeActivityFactor } from "./activity";

export type TdeeMode = "COEFFICIENT" | "ADDITIVE";
export type TdeeConfidence = "HIGH" | "MEDIUM" | "LOW";

export type ActivityForTdee = {
  activityKey: string;
  caloriesKcal: number;
  conservativeCaloriesKcal?: number | null;
  confidenceFactor?: number | null;
  countsTowardTdee?: boolean | null;
  source?: string | null;
};

export type WeeklyTrendForTdee = {
  averageWeightKg: number;
  waistCm?: number | null;
  adherencePct?: number | null;
};

export type FoodDayForTdee = {
  kcal: number;
};

export function calculateBaseTdee(input: { bmr: number; activityFactor: number; adjustmentKcal?: number | null }) {
  return Math.max(0, Math.round(input.bmr * input.activityFactor + (input.adjustmentKcal ?? 0)));
}

export function shouldCountActivity(input: {
  mode: TdeeMode;
  activityFactor: number;
  activityKey: string;
  userChoice?: "auto" | "ignore" | "count_extra";
}) {
  if (input.userChoice === "ignore") return false;
  if (input.userChoice === "count_extra") return true;
  if (input.mode === "ADDITIVE") return true;

  const category = activityCategory(input.activityKey);
  if (category === "strength" && input.activityFactor >= 1.55) return false;

  return category === "walking" || category === "cardio" || category === "sport";
}

export function conservativeActivityCalories(activity: ActivityForTdee) {
  const factor = activity.confidenceFactor ?? conservativeActivityFactor({ activityKey: activity.activityKey, source: activity.source });
  return Math.round(activity.conservativeCaloriesKcal ?? activity.caloriesKcal * factor);
}

export function activityContribution(input: {
  mode: TdeeMode;
  activityFactor: number;
  activities: ActivityForTdee[];
}) {
  const items = input.activities.map((activity) => {
    const autoCount = shouldCountActivity({
      mode: input.mode,
      activityFactor: input.activityFactor,
      activityKey: activity.activityKey,
    });
    const counted = activity.countsTowardTdee ?? autoCount;
    const conservativeKcal = conservativeActivityCalories(activity);

    return {
      ...activity,
      category: activityCategory(activity.activityKey),
      counted,
      conservativeKcal,
    };
  });

  return {
    rawKcal: Math.round(items.reduce((total, item) => total + item.caloriesKcal, 0)),
    countedKcal: Math.round(items.filter((item) => item.counted).reduce((total, item) => total + item.conservativeKcal, 0)),
    ignoredKcal: Math.round(items.filter((item) => !item.counted).reduce((total, item) => total + item.caloriesKcal, 0)),
    items,
  };
}

export function effectiveTdee(input: {
  bmr: number;
  activityFactor: number;
  mode: TdeeMode;
  activities: ActivityForTdee[];
  adjustmentKcal?: number | null;
}) {
  const base = calculateBaseTdee({
    bmr: input.bmr,
    activityFactor: input.activityFactor,
    adjustmentKcal: input.adjustmentKcal,
  });
  const contribution = activityContribution({
    mode: input.mode,
    activityFactor: input.activityFactor,
    activities: input.activities,
  });

  return {
    base,
    activityKcal: contribution.countedKcal,
    rawActivityKcal: contribution.rawKcal,
    ignoredActivityKcal: contribution.ignoredKcal,
    total: base + contribution.countedKcal,
    contribution,
  };
}

export function tdeeInflationWarning(input: { activityFactor: number; activityKey: string; mode: TdeeMode }) {
  return input.mode === "COEFFICIENT" && input.activityFactor >= 1.55 && activityCategory(input.activityKey) === "strength"
    ? "Musculacao provavelmente ja esta incluida no fator de atividade. Somar novamente pode inflar seu TDEE."
    : null;
}

export function validateTdeeTrend(input: {
  tdee: number;
  averageIntakeKcal: number;
  checkins: WeeklyTrendForTdee[];
}) {
  const recent = input.checkins.slice(-3);
  if (recent.length < 3 || !input.averageIntakeKcal) {
    return {
      confidence: "MEDIUM" as TdeeConfidence,
      suggestedAdjustmentKcal: 0,
      message: "Precisa de pelo menos 3 check-ins semanais para validar tendencia corporal.",
    };
  }

  const first = recent[0];
  const last = recent[recent.length - 1];
  const weightDeltaPerWeek = (last.averageWeightKg - first.averageWeightKg) / (recent.length - 1);
  const waistDelta = typeof first.waistCm === "number" && typeof last.waistCm === "number" ? last.waistCm - first.waistCm : null;
  const predictedWeeklyLossKg = Math.max(0, ((input.tdee - input.averageIntakeKcal) * 7) / 7700);
  const actualWeeklyLossKg = -weightDeltaPerWeek;
  const bodyNotMoving = actualWeeklyLossKg < 0.15 && (waistDelta == null || waistDelta >= -0.5);
  const losingMuchFaster = predictedWeeklyLossKg > 0 && actualWeeklyLossKg > predictedWeeklyLossKg + 0.45;
  const predictedDeficit = input.tdee - input.averageIntakeKcal;

  if (predictedDeficit >= 400 && bodyNotMoving) {
    return {
      confidence: "LOW" as TdeeConfidence,
      suggestedAdjustmentKcal: -150,
      message: "Tendencia corporal abaixo do deficit previsto. Possivel TDEE superestimado; reduza a estimativa aos poucos.",
    };
  }

  if (losingMuchFaster && (waistDelta == null || waistDelta < -0.5)) {
    return {
      confidence: "LOW" as TdeeConfidence,
      suggestedAdjustmentKcal: 150,
      message: "Perda maior que o previsto por mais de 2 semanas. Possivel TDEE subestimado ou ingestao abaixo do registrado.",
    };
  }

  const divergence = Math.abs(actualWeeklyLossKg - predictedWeeklyLossKg);
  if (divergence <= 0.3 || (waistDelta != null && waistDelta < 0 && actualWeeklyLossKg >= 0)) {
    return {
      confidence: "HIGH" as TdeeConfidence,
      suggestedAdjustmentKcal: 0,
      message: "Tendencia de peso e cintura compativel com o deficit estimado.",
    };
  }

  return {
    confidence: "MEDIUM" as TdeeConfidence,
    suggestedAdjustmentKcal: 0,
    message: "Ha pequenas divergencias. Mantenha mais uma semana antes de ajustar.",
  };
}
