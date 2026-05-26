export type SupplementType = "CREATINE" | "BETA_ALANINE";
export type SupplementProtocol = "LOADING" | "STEADY";

export type SupplementPlanInput = {
  type: SupplementType;
  protocol: SupplementProtocol;
  dailyDoseG: number;
  startedAt: Date;
  logs: Array<{ date: Date; doseG: number }>;
  now?: Date;
};

const dayMs = 24 * 60 * 60 * 1000;

export function recommendedSupplementDose(type: SupplementType, protocol: SupplementProtocol) {
  if (type === "CREATINE") return protocol === "LOADING" ? 20 : 5;
  return 4;
}

export function supplementDisplayName(type: SupplementType) {
  return type === "CREATINE" ? "Creatina" : "Beta-alanina";
}

export function supplementProtocolLabel(protocol: SupplementProtocol) {
  return protocol === "LOADING" ? "com fase de carga" : "uso contínuo";
}

export function estimateSupplementProgress(input: SupplementPlanInput) {
  const now = input.now ?? new Date();
  const elapsedDays = Math.max(1, daysInclusive(input.startedAt, now));
  const expectedDose = input.dailyDoseG * elapsedDays;
  const loggedDose = input.logs.reduce((total, log) => total + Math.max(0, log.doseG), 0);
  const effectiveDose = Math.max(loggedDose, expectedDose);
  const targetDose = targetCumulativeDose(input.type, input.protocol, input.dailyDoseG);
  const pct = clamp(Math.round((effectiveDose / targetDose) * 100), 0, 100);
  const adherencePct = clamp(Math.round((loggedDose / Math.max(expectedDose, 1)) * 100), 0, 120);
  const daysRemaining = Math.max(0, Math.ceil((targetDose - effectiveDose) / Math.max(input.dailyDoseG, 0.1)));

  return {
    percent: pct,
    elapsedDays,
    daysRemaining,
    loggedDoseG: round(loggedDose),
    expectedDoseG: round(expectedDose),
    targetDoseG: round(targetDose),
    adherencePct,
    status: statusLabel(input.type, pct),
    guidance: guidanceText(input.type, input.protocol, pct, daysRemaining),
  };
}

export function supplementSafetyNote(type: SupplementType) {
  if (type === "CREATINE") {
    return "Evite usar como orientação clínica em doença renal, gestação, uso de medicação ou restrição médica. Procure profissional de saúde.";
  }

  return "Beta-alanina pode causar formigamento, especialmente em doses altas de uma vez. Dividir doses costuma melhorar tolerância.";
}

function targetCumulativeDose(type: SupplementType, protocol: SupplementProtocol, dailyDoseG: number) {
  if (type === "CREATINE") {
    return protocol === "LOADING" ? 100 : Math.max(84, dailyDoseG * 28);
  }

  return Math.max(112, dailyDoseG * 28);
}

function guidanceText(type: SupplementType, protocol: SupplementProtocol, pct: number, daysRemaining: number) {
  if (pct >= 100) {
    return type === "CREATINE"
      ? "Fase estimada completa. Agora o foco é manter regularidade diária."
      : "Adaptação estimada completa. Mantenha regularidade se o suplemento fizer sentido no treino.";
  }

  if (type === "CREATINE" && protocol === "LOADING") {
    return `Faltam cerca de ${daysRemaining} dias para completar a fase de carga estimada.`;
  }

  return `Faltam cerca de ${daysRemaining} dias no ritmo atual. Regularidade importa mais que horário exato.`;
}

function statusLabel(type: SupplementType, pct: number) {
  if (pct >= 100) return type === "CREATINE" ? "saturado estimado" : "adaptado estimado";
  if (pct >= 70) return "fase final";
  if (pct >= 35) return "acumulando";
  return "início";
}

function daysInclusive(start: Date, end: Date) {
  const startDay = new Date(start);
  const endDay = new Date(end);
  startDay.setHours(0, 0, 0, 0);
  endDay.setHours(0, 0, 0, 0);
  return Math.floor((endDay.getTime() - startDay.getTime()) / dayMs) + 1;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
