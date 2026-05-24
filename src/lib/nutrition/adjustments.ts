import type { Goal } from "./types";

export type WeeklySignal = {
  averageWeightKg: number;
  adherencePct: number;
  hunger: number;
  energy: number;
  sleep: number;
};

export function suggestCalorieAdjustment(input: {
  goal: Goal;
  currentCalories: number;
  weeks: WeeklySignal[];
}) {
  const recent = input.weeks.slice(-2);
  if (recent.length < 2) {
    return { delta: 0, reason: "Aguardando ao menos 2 check-ins semanais.", severity: "info" as const };
  }

  const [previous, current] = recent;
  const change = current.averageWeightKg - previous.averageWeightKg;
  const highFatigue = current.hunger >= 8 || current.energy <= 4 || current.sleep <= 4;

  if (input.goal === "fat_loss") {
    if (change >= -0.1 && current.adherencePct >= 80) {
      const delta = highFatigue ? -100 : -150;
      return { delta, reason: "Peso estabilizado por 2 semanas com boa aderência.", severity: "action" as const };
    }
    if (change <= -1 || highFatigue) {
      return { delta: 150, reason: "Ritmo de queda, fome ou fadiga sugerem déficit agressivo.", severity: "warning" as const };
    }
  }

  if (input.goal === "muscle_gain" && change <= 0.1 && current.adherencePct >= 80) {
    return { delta: highFatigue ? 100 : 200, reason: "Peso não subiu por 2 semanas com boa aderência.", severity: "action" as const };
  }

  return { delta: 0, reason: "Manter estratégia atual e reavaliar no próximo check-in.", severity: "info" as const };
}

export function assessDeficitRisk(input: { weightKg: number; deficitKcal: number }) {
  if (!input.weightKg || !input.deficitKcal) {
    return {
      level: "info" as const,
      message: "Escolha um déficit para ver o impacto esperado.",
    };
  }

  const kcalPerKg = input.deficitKcal / input.weightKg;

  if (input.deficitKcal <= 200) {
    return {
      level: "info" as const,
      message: "Déficit conservador. A perda tende a ser mais lenta, mas costuma ser mais fácil de sustentar.",
    };
  }

  if (kcalPerKg <= 5) {
    return {
      level: "good" as const,
      message: "Déficit moderado para seu peso. Boa faixa inicial se proteína, treino e sono estiverem em dia.",
    };
  }

  if (kcalPerKg <= 8) {
    return {
      level: "warning" as const,
      message: "Déficit mais agressivo. Monitore fome, energia, treino e proteína para reduzir risco de perder massa muscular.",
    };
  }

  return {
    level: "danger" as const,
    message: "Déficit alto para seu peso. Isso pode aumentar fome, queda de performance e risco de perder massa muscular.",
  };
}
