import type { CoachContext, CoachInsight } from "./types";

type Trigger = {
  id: string;
  priority: number;
  category: CoachInsight["category"];
  when: (context: CoachContext) => boolean;
  message: string;
};

export const coachTriggers: Trigger[] = [
  {
    id: "protein_drop_3d",
    priority: 80,
    category: "nutrition",
    when: (ctx) => ctx.proteinLast3DaysPct.length === 3 && ctx.proteinLast3DaysPct.every((pct) => pct < 90),
    message: "Sua ingestão de proteína caiu nos últimos 3 dias.",
  },
  {
    id: "weight_plateau_14d",
    priority: 95,
    category: "weight",
    when: (ctx) => ctx.goal === "fat_loss" && ctx.weightStableDays >= 14,
    message: "Seu peso estabilizou por 14 dias. Talvez seja hora de revisar calorias.",
  },
  {
    id: "adherence_streak_5d",
    priority: 55,
    category: "adherence",
    when: (ctx) => ctx.adherenceStreakDays >= 5,
    message: "Você bateu suas metas 5 dias seguidos. Excelente consistência.",
  },
  {
    id: "sleep_decline",
    priority: 70,
    category: "sleep",
    when: (ctx) => ctx.sleepTrend === "down",
    message: "Seu sono caiu esta semana. Isso pode impactar fome e recuperação.",
  },
  {
    id: "aggressive_deficit",
    priority: 90,
    category: "nutrition",
    when: (ctx) => ctx.goal === "fat_loss" && ctx.currentDeficitPct >= 25,
    message: "Sua redução de calorias parece alta. Vale revisar antes de continuar assim.",
  },
  {
    id: "training_low",
    priority: 60,
    category: "training",
    when: (ctx) => ctx.trainingDoneThisWeek <= 1,
    message: "Seu volume de treino esta baixo nesta semana. Ajuste a agenda antes de mexer nas calorias.",
  },
  {
    id: "micros_low",
    priority: 65,
    category: "nutrition",
    when: (ctx) => Boolean(ctx.lowMicronutrients?.length),
    message: "Alguns micronutrientes ficaram baixos hoje. Vale revisar variedade de frutas, verduras, laticínios ou leguminosas.",
  },
];

export function generateCoachInsights(context: CoachContext, now = new Date()): CoachInsight[] {
  return coachTriggers
    .filter((trigger) => trigger.when(context))
    .sort((a, b) => b.priority - a.priority)
    .map((trigger) => ({
      trigger: trigger.id,
      priority: trigger.priority,
      status: "new",
      category: trigger.category,
      message: trigger.message,
      createdAt: now,
    }));
}

export function dailyBriefing(input: {
  averageWeightKg: number;
  adherencePct: number;
  macroCompletionPct: number;
  sleepScore: number;
  insights: CoachInsight[];
}) {
  const topInsight = [...input.insights].sort((a, b) => b.priority - a.priority)[0];
  return {
    averageWeightKg: input.averageWeightKg,
    adherencePct: input.adherencePct,
    macroCompletionPct: input.macroCompletionPct,
    sleepScore: input.sleepScore,
    recommendation: topInsight?.message ?? "Sem ajustes hoje. Mantenha o plano e registre suas refeições.",
  };
}

export function consistencyScore(input: {
  dietAdherencePct: number;
  checkinsDone: number;
  checkinsTarget: number;
  proteinHitDays: number;
  sleepScore: number;
  trainingDone: number;
  trainingTarget: number;
}) {
  const checkinScore = ratio(input.checkinsDone, input.checkinsTarget);
  const proteinScore = ratio(input.proteinHitDays, 7);
  const sleepScore = Math.min(1, input.sleepScore / 10);
  const trainingScore = ratio(input.trainingDone, input.trainingTarget);
  const dietScore = Math.min(1, input.dietAdherencePct / 100);

  return Math.round((dietScore * 0.35 + checkinScore * 0.15 + proteinScore * 0.2 + sleepScore * 0.15 + trainingScore * 0.15) * 100);
}

function ratio(value: number, target: number) {
  if (!target) return 0;
  return Math.min(1, value / target);
}
