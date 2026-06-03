import { appDateInputValue, startOfDayInTimeZone } from "./date-time";

export type TrainingTrend = "improving" | "stable" | "declining" | "insufficient";
export type TrainingConfidence = "high" | "medium" | "low";

export type TrainingLogInput = {
  exerciseId: string;
  exerciseName: string;
  date: Date;
  setsDone?: number | null;
  repsDone?: string | null;
  loadKg?: number | null;
  rpe?: number | null;
  muscleGroup?: string | null;
};

export type TrainingPerformanceAlert = {
  type: "progress" | "drop" | "fatigue" | "data";
  priority: number;
  message: string;
};

export type TrainingPerformance = {
  score: number;
  trend: TrainingTrend;
  confidence: TrainingConfidence;
  trainedDays: number;
  loggedExercises: number;
  comparableExercises: number;
  improvedExercises: number;
  declinedExercises: number;
  stableExercises: number;
  highRpeLogs: number;
  averageRpe: number | null;
  primaryMessage: string;
  alerts: TrainingPerformanceAlert[];
};

export type TrainingPlanWithLogsInput = {
  days: Array<{
    exercises: Array<{
      id: string;
      name: string;
      muscleGroup?: string | null;
      logs: Array<{
        date: Date;
        setsDone?: number | null;
        repsDone?: string | null;
        loadKg?: number | null;
        rpe?: number | null;
      }>;
    }>;
  }>;
};

type ComparableExercise = {
  status: "improved" | "declined" | "stable";
  exerciseName: string;
};

export function trainingLogsFromPlan(plan: TrainingPlanWithLogsInput): TrainingLogInput[] {
  return plan.days.flatMap((day) =>
    day.exercises.flatMap((exercise) =>
      exercise.logs.map((log) => ({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        muscleGroup: exercise.muscleGroup,
        date: log.date,
        setsDone: log.setsDone,
        repsDone: log.repsDone,
        loadKg: log.loadKg,
        rpe: log.rpe,
      })),
    ),
  );
}

export function trainingLogsFromPlans(plans: TrainingPlanWithLogsInput[]): TrainingLogInput[] {
  return plans.flatMap((plan) => trainingLogsFromPlan(plan));
}

export function analyzeTrainingPerformance(logs: TrainingLogInput[], now = new Date()): TrainingPerformance {
  const recentLogs = logs
    .filter((log) => daysBetween(log.date, now) <= 45)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const loggedExercises = new Set(recentLogs.map((log) => log.exerciseId)).size;
  const trainedDays = new Set(recentLogs.map((log) => dateKey(log.date))).size;
  const rpeValues = recentLogs.map((log) => log.rpe).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const highRpeLogs = rpeValues.filter((value) => value >= 9).length;
  const averageRpe = rpeValues.length ? round1(rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length) : null;
  const grouped = groupByExercise(recentLogs);
  const comparisons = Array.from(grouped.values()).map(compareExercise).filter(Boolean) as ComparableExercise[];
  const improvedExercises = comparisons.filter((item) => item.status === "improved").length;
  const declinedExercises = comparisons.filter((item) => item.status === "declined").length;
  const stableExercises = comparisons.filter((item) => item.status === "stable").length;
  const comparableExercises = comparisons.length;
  const trend = trainingTrend({ comparableExercises, improvedExercises, declinedExercises });
  const confidence = trainingConfidence({ trainedDays, comparableExercises, loggedExercises });
  const score = trainingScore({ trainedDays, improvedExercises, declinedExercises, stableExercises, highRpeLogs, averageRpe, confidence });
  const alerts = trainingAlerts({ trend, confidence, trainedDays, improvedExercises, declinedExercises, highRpeLogs, averageRpe });

  return {
    score,
    trend,
    confidence,
    trainedDays,
    loggedExercises,
    comparableExercises,
    improvedExercises,
    declinedExercises,
    stableExercises,
    highRpeLogs,
    averageRpe,
    primaryMessage: primaryMessage({ trend, confidence, score, trainedDays, improvedExercises, declinedExercises }),
    alerts,
  };
}

export function parseRepsValue(value?: string | null) {
  if (!value) return null;
  const numbers = value
    .replace(/,/g, ".")
    .match(/\d+(\.\d+)?/g)
    ?.map(Number)
    .filter((item) => Number.isFinite(item));

  if (!numbers?.length) return null;
  if (numbers.length === 1) return numbers[0];
  return round1(numbers.reduce((sum, item) => sum + item, 0));
}

export function trainingPerformanceTone(performance: TrainingPerformance) {
  if (performance.trend === "declining" || performance.score < 45) return "danger";
  if (performance.trend === "improving" || performance.score >= 75) return "good";
  if (performance.confidence === "low") return "warning";
  return "neutral";
}

function groupByExercise(logs: TrainingLogInput[]) {
  const grouped = new Map<string, TrainingLogInput[]>();
  for (const log of logs) {
    const current = grouped.get(log.exerciseId) ?? [];
    current.push(log);
    grouped.set(log.exerciseId, current);
  }
  for (const group of grouped.values()) {
    group.sort((a, b) => b.date.getTime() - a.date.getTime());
  }
  return grouped;
}

function compareExercise(logs: TrainingLogInput[]): ComparableExercise | null {
  if (logs.length < 2) return null;
  const latest = logs[0];
  const previous = logs[1];
  const latestLoad = normalizeNumber(latest.loadKg);
  const previousLoad = normalizeNumber(previous.loadKg);
  const latestReps = parseRepsValue(latest.repsDone);
  const previousReps = parseRepsValue(previous.repsDone);
  const latestVolume = latestLoad && latestReps ? latestLoad * latestReps : null;
  const previousVolume = previousLoad && previousReps ? previousLoad * previousReps : null;

  if (latestLoad && previousLoad) {
    const loadDeltaPct = ((latestLoad - previousLoad) / previousLoad) * 100;
    if (loadDeltaPct >= 2.5) return { status: "improved", exerciseName: latest.exerciseName };
    if (loadDeltaPct <= -2.5) return { status: "declined", exerciseName: latest.exerciseName };
  }

  if (latestVolume && previousVolume) {
    const volumeDeltaPct = ((latestVolume - previousVolume) / previousVolume) * 100;
    if (volumeDeltaPct >= 5) return { status: "improved", exerciseName: latest.exerciseName };
    if (volumeDeltaPct <= -7) return { status: "declined", exerciseName: latest.exerciseName };
  }

  if (latestReps != null && previousReps != null) {
    const repsDelta = latestReps - previousReps;
    const rpeWorse = (latest.rpe ?? 0) >= (previous.rpe ?? 0);
    if (repsDelta >= 2) return { status: "improved", exerciseName: latest.exerciseName };
    if (repsDelta <= -2 && rpeWorse) return { status: "declined", exerciseName: latest.exerciseName };
  }

  return { status: "stable", exerciseName: latest.exerciseName };
}

function trainingTrend(input: { comparableExercises: number; improvedExercises: number; declinedExercises: number }): TrainingTrend {
  if (input.comparableExercises < 2) return "insufficient";
  if (input.declinedExercises >= 2 && input.declinedExercises > input.improvedExercises) return "declining";
  if (input.improvedExercises >= 1 && input.improvedExercises > input.declinedExercises) return "improving";
  return "stable";
}

function trainingConfidence(input: { trainedDays: number; comparableExercises: number; loggedExercises: number }): TrainingConfidence {
  if (input.trainedDays >= 6 && input.comparableExercises >= 4) return "high";
  if (input.trainedDays >= 3 && input.comparableExercises >= 2) return "medium";
  if (input.trainedDays >= 3 && input.loggedExercises >= 10) return "medium";
  if (input.loggedExercises >= 3 && input.comparableExercises >= 1) return "medium";
  return "low";
}

function trainingScore(input: {
  trainedDays: number;
  improvedExercises: number;
  declinedExercises: number;
  stableExercises: number;
  highRpeLogs: number;
  averageRpe: number | null;
  confidence: TrainingConfidence;
}) {
  let score = 62;
  score += Math.min(18, input.trainedDays * 3);
  score += Math.min(18, input.improvedExercises * 7);
  score += Math.min(8, input.stableExercises * 2);
  score -= Math.min(28, input.declinedExercises * 10);
  score -= Math.min(12, input.highRpeLogs * 2);
  if ((input.averageRpe ?? 0) >= 9) score -= 8;
  if (input.confidence === "low") score -= 8;
  return clamp(Math.round(score), 0, 100);
}

function trainingAlerts(input: {
  trend: TrainingTrend;
  confidence: TrainingConfidence;
  trainedDays: number;
  improvedExercises: number;
  declinedExercises: number;
  highRpeLogs: number;
  averageRpe: number | null;
}) {
  const alerts: TrainingPerformanceAlert[] = [];
  if (input.trend === "declining") {
    alerts.push({
      type: "drop",
      priority: 90,
      message: "Carga ou repeticoes cairam em exercicios suficientes para revisar recuperacao, sono, deficit e volume de treino.",
    });
  }
  if (input.trend === "improving") {
    alerts.push({
      type: "progress",
      priority: 70,
      message: "Seu treino mostra progressao real. Isso melhora a confianca na preservacao de massa magra.",
    });
  }
  if (input.highRpeLogs >= 3 || (input.averageRpe ?? 0) >= 9) {
    alerts.push({
      type: "fatigue",
      priority: 75,
      message: "RPE alto apareceu varias vezes. Se isso vier junto com queda de carga, pode ser fadiga acumulada.",
    });
  }
  if (input.confidence === "low") {
    alerts.push({
      type: "data",
      priority: 45,
      message: "Registre carga e repeticoes por mais treinos para o ShapeOS detectar tendencia com mais confianca.",
    });
  }
  return alerts.sort((a, b) => b.priority - a.priority);
}

function primaryMessage(input: {
  trend: TrainingTrend;
  confidence: TrainingConfidence;
  score: number;
  trainedDays: number;
  improvedExercises: number;
  declinedExercises: number;
}) {
  if (input.trend === "improving") return `Performance subindo: ${input.improvedExercises} exercicio(s) melhoraram nos ultimos registros.`;
  if (input.trend === "declining") return `Performance em queda: ${input.declinedExercises} exercicio(s) pioraram. Confira sono, deficit e recuperacao.`;
  if (input.trend === "stable") return "Performance estavel. Bom sinal se a cintura/BF estao caindo sem perda grande de carga.";
  if (input.trainedDays === 0) return "Nenhum treino registrado ainda. Lance carga e repeticoes para acompanhar progressao.";
  if (input.trainedDays >= 3) return "Voce ja registrou varios treinos. A tendencia de carga comeca quando algum exercicio for repetido.";
  return "Ainda falta repeticao de registros por exercicio para comparar progressao.";
}

function daysBetween(date: Date, now: Date) {
  return Math.max(0, (startOfDayInTimeZone(now).getTime() - startOfDayInTimeZone(date).getTime()) / 86_400_000);
}

function dateKey(date: Date) {
  return appDateInputValue(date);
}

function normalizeNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
