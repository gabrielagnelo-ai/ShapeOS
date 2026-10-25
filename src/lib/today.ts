// Resumos da tela Hoje: refeições do dia, próximo treino, semana de treinos, sono e energia corporal.
import { APP_TIME_ZONE } from "@/lib/date-time";
import { mealOrder, normalizeMealName } from "@/lib/meals";
import { clamp } from "@/lib/common";

const DAY = 24 * 60 * 60 * 1000;
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });

// ---------- refeições ----------
export type TodayMeal = { name: string; kcal: number; status: "logged" | "planned" };

// Refeições já registradas hoje (somando os itens) e, das previstas no plano, as que ainda faltam.
export function summarizeTodayMeals(
  logged: { mealName: string; kcal: number }[],
  planned: { name: string; kcal: number }[],
): TodayMeal[] {
  const byMeal = new Map<string, number>();
  for (const item of logged) {
    const name = normalizeMealName(item.mealName);
    byMeal.set(name, (byMeal.get(name) ?? 0) + item.kcal);
  }
  const meals: TodayMeal[] = [...byMeal].map(([name, kcal]) => ({ name, kcal: Math.round(kcal), status: "logged" }));
  for (const meal of planned) {
    const name = normalizeMealName(meal.name);
    if (!byMeal.has(name)) meals.push({ name, kcal: Math.round(meal.kcal), status: "planned" });
  }
  return meals.sort((a, b) => mealOrder(a.name) - mealOrder(b.name));
}

// ---------- treino ----------
type ExerciseLike = { name: string; sets: string | null; reps: string | null; logs: { date: Date; loadKg: number | null }[] };
type DayLike = { name: string; focus: string | null; order: number; exercises: ExerciseLike[] };

export type NextTraining = {
  name: string;
  focus: string | null;
  exerciseCount: number;
  exercises: { name: string; prescription: string | null; loadKg: number | null; loadDeltaKg: number | null }[];
};

// O plano não tem dia da semana: o próximo treino é o dia seguinte ao último treinado (em rodízio).
export function nextTrainingDay(days: DayLike[]): NextTraining | null {
  if (!days.length) return null;
  const ordered = [...days].sort((a, b) => a.order - b.order);
  const lastTrained = (day: DayLike) => Math.max(0, ...day.exercises.flatMap((e) => e.logs.map((l) => l.date.getTime())));
  let latestIndex = -1, latest = 0;
  ordered.forEach((day, i) => {
    const t = lastTrained(day);
    if (t > latest) { latest = t; latestIndex = i; }
  });
  const next = ordered[(latestIndex + 1) % ordered.length];
  return {
    name: next.name,
    focus: next.focus,
    exerciseCount: next.exercises.length,
    exercises: next.exercises.slice(0, 3).map((exercise) => {
      const loads = [...exercise.logs].sort((a, b) => b.date.getTime() - a.date.getTime()).map((l) => l.loadKg).filter((v): v is number => v != null);
      return {
        name: exercise.name,
        prescription: exercise.sets && exercise.reps ? `${exercise.sets} séries de ${exercise.reps}` : exercise.sets ? `${exercise.sets} séries` : null,
        loadKg: loads[0] ?? null,
        loadDeltaKg: loads.length > 1 ? Math.round((loads[0] - loads[1]) * 10) / 10 : null,
      };
    }),
  };
}

// Últimos 7 dias (do mais antigo ao de hoje): houve treino registrado?
export function trainingWeek(logDates: Date[], today: Date) {
  const done = new Set(logDates.map(dayKey));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today.getTime() - (6 - i) * DAY);
    return { date, trained: done.has(dayKey(date)) };
  });
}

// ---------- sono e energia (Apple Saúde) ----------
type HealthLike = {
  date: Date;
  sleepMinutes: number | null;
  restingHeartRateBpm: number | null;
  activeEnergyKcal: number | null;
  workoutMinutes: number | null;
  steps: number | null;
};

export type SleepSummary = { lastNightMinutes: number; averageMinutes: number; nights: (number | null)[] };

export function summarizeSleep(days: HealthLike[]): SleepSummary | null {
  const sorted = [...days].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-7);
  const withSleep = sorted.filter((d) => d.sleepMinutes != null);
  if (!withSleep.length) return null;
  return {
    lastNightMinutes: withSleep[withSleep.length - 1].sleepMinutes!,
    averageMinutes: Math.round(withSleep.reduce((s, d) => s + d.sleepMinutes!, 0) / withSleep.length),
    nights: sorted.map((d) => d.sleepMinutes),
  };
}

export type BodyEnergy = {
  score: number;
  level: "alta" | "boa" | "moderada" | "baixa";
  sleepRecharge: number;
  restingHeartRate: { bpm: number; vsAverage: number | null } | null;
  drain: number;
  steps: number | null;
  history: { date: Date; score: number }[];
};

function energyFor(day: HealthLike, baselineRhr: number | null) {
  const recharge = day.sleepMinutes != null ? Math.round(clamp(day.sleepMinutes / 480, 0, 1.05) * 60) : 35;
  const rhrDelta = day.restingHeartRateBpm != null && baselineRhr != null ? day.restingHeartRateBpm - baselineRhr : 0;
  const heart = clamp(-rhrDelta * 3, -15, 10);
  const drain = Math.round((day.activeEnergyKcal ?? 0) / 25 + (day.workoutMinutes ?? 0) / 4);
  return { score: Math.round(clamp(30 + recharge + heart - drain, 5, 100)), recharge, drain };
}

// Estimativa simples, inspirada em "bateria corporal": sono recarrega, FC de repouso acima da média e
// atividade gastam. Usa só o que o Apple Saúde sincroniza (sem dados por hora).
export function estimateBodyEnergy(days: HealthLike[]): BodyEnergy | null {
  const sorted = [...days].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-8);
  if (!sorted.some((d) => d.sleepMinutes != null || d.restingHeartRateBpm != null)) return null;
  const baselineFor = (i: number) => {
    const prior = sorted.slice(Math.max(0, i - 7), i).map((d) => d.restingHeartRateBpm).filter((v): v is number => v != null);
    return prior.length ? prior.reduce((s, v) => s + v, 0) / prior.length : null;
  };
  const history = sorted.map((day, i) => ({ date: day.date, ...energyFor(day, baselineFor(i)) }));
  const today = history[history.length - 1];
  const todayData = sorted[sorted.length - 1];
  const baseline = baselineFor(sorted.length - 1);
  return {
    score: today.score,
    level: today.score >= 75 ? "alta" : today.score >= 50 ? "boa" : today.score >= 25 ? "moderada" : "baixa",
    sleepRecharge: today.recharge,
    restingHeartRate: todayData.restingHeartRateBpm != null
      ? { bpm: todayData.restingHeartRateBpm, vsAverage: baseline != null ? Math.round(todayData.restingHeartRateBpm - baseline) : null }
      : null,
    drain: today.drain,
    steps: todayData.steps,
    history: history.slice(-7).map(({ date, score }) => ({ date, score })),
  };
}
