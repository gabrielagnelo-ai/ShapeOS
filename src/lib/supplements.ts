export type SupplementType = "CREATINE" | "BETA_ALANINE" | "MULTIVITAMIN";
export type SupplementProtocol = "LOADING" | "STEADY";

export type SupplementMicronutrients = {
  vitaminAMcg: number;
  vitaminEMg: number;
  vitaminKMcg: number;
  calciumMg: number;
  ironMg: number;
  magnesiumMg: number;
  potassiumMg: number;
  zincMg: number;
  vitaminCMg: number;
  vitaminDMcg: number;
  vitaminB1Mg: number;
  vitaminB2Mg: number;
  vitaminB3Mg: number;
  vitaminB5Mg: number;
  vitaminB6Mg: number;
  vitaminB7Mcg: number;
  vitaminB9Mcg: number;
  vitaminB12Mcg: number;
  copperMcg: number;
  chromiumMcg: number;
  iodineMcg: number;
  manganeseMg: number;
  molybdenumMcg: number;
  seleniumMcg: number;
};

export const emptySupplementMicronutrients: SupplementMicronutrients = {
  vitaminAMcg: 0,
  vitaminEMg: 0,
  vitaminKMcg: 0,
  calciumMg: 0,
  ironMg: 0,
  magnesiumMg: 0,
  potassiumMg: 0,
  zincMg: 0,
  vitaminCMg: 0,
  vitaminDMcg: 0,
  vitaminB1Mg: 0,
  vitaminB2Mg: 0,
  vitaminB3Mg: 0,
  vitaminB5Mg: 0,
  vitaminB6Mg: 0,
  vitaminB7Mcg: 0,
  vitaminB9Mcg: 0,
  vitaminB12Mcg: 0,
  copperMcg: 0,
  chromiumMcg: 0,
  iodineMcg: 0,
  manganeseMg: 0,
  molybdenumMcg: 0,
  seleniumMcg: 0,
};

export const supplementNutrientDefinitions = [
  { key: "vitaminAMcg", label: "Vitamina A", unit: "mcg", dailyValue: 800 },
  { key: "vitaminDMcg", label: "Vitamina D", unit: "mcg", dailyValue: 15 },
  { key: "vitaminEMg", label: "Vitamina E", unit: "mg", dailyValue: 15 },
  { key: "vitaminKMcg", label: "Vitamina K", unit: "mcg", dailyValue: 120 },
  { key: "vitaminCMg", label: "Vitamina C", unit: "mg", dailyValue: 100 },
  { key: "vitaminB1Mg", label: "Vitamina B1", unit: "mg", dailyValue: 1.2 },
  { key: "vitaminB2Mg", label: "Vitamina B2", unit: "mg", dailyValue: 1.2 },
  { key: "vitaminB3Mg", label: "Vitamina B3", unit: "mg", dailyValue: 15 },
  { key: "vitaminB5Mg", label: "Vitamina B5", unit: "mg", dailyValue: 5 },
  { key: "vitaminB6Mg", label: "Vitamina B6", unit: "mg", dailyValue: 1.3 },
  { key: "vitaminB7Mcg", label: "Vitamina B7", unit: "mcg", dailyValue: 30 },
  { key: "vitaminB9Mcg", label: "Vitamina B9", unit: "mcg", dailyValue: 400 },
  { key: "vitaminB12Mcg", label: "Vitamina B12", unit: "mcg", dailyValue: 2.4 },
  { key: "copperMcg", label: "Cobre", unit: "mcg", dailyValue: 900 },
  { key: "chromiumMcg", label: "Cromo", unit: "mcg", dailyValue: 35 },
  { key: "calciumMg", label: "Cálcio", unit: "mg", dailyValue: 1000 },
  { key: "ironMg", label: "Ferro", unit: "mg", dailyValue: 14 },
  { key: "iodineMcg", label: "Iodo", unit: "mcg", dailyValue: 150 },
  { key: "magnesiumMg", label: "Magnésio", unit: "mg", dailyValue: 420 },
  { key: "manganeseMg", label: "Manganês", unit: "mg", dailyValue: 3 },
  { key: "molybdenumMcg", label: "Molibdênio", unit: "mcg", dailyValue: 45 },
  { key: "potassiumMg", label: "Potássio", unit: "mg", dailyValue: 3500 },
  { key: "seleniumMcg", label: "Selênio", unit: "mcg", dailyValue: 60 },
  { key: "zincMg", label: "Zinco", unit: "mg", dailyValue: 11 },
] as const satisfies ReadonlyArray<{
  key: keyof SupplementMicronutrients;
  label: string;
  unit: "mg" | "mcg";
  dailyValue: number;
}>;

export type SupplementPlanInput = {
  type: SupplementType;
  protocol: SupplementProtocol;
  dailyDoseG: number;
  startedAt: Date;
  logs: Array<{ date: Date; doseG: number }>;
  periods?: Array<{ startDate: Date; endDate: Date | null; dailyDoseG: number; adherencePct: number }>;
  now?: Date;
};

const dayMs = 24 * 60 * 60 * 1000;

export function recommendedSupplementDose(type: SupplementType, protocol: SupplementProtocol) {
  if (type === "CREATINE") return protocol === "LOADING" ? 20 : 5;
  if (type === "MULTIVITAMIN") return 1;
  return 4;
}

export function supplementDisplayName(type: SupplementType) {
  if (type === "CREATINE") return "Creatina";
  if (type === "BETA_ALANINE") return "Beta-alanina";
  return "Multivitamínico";
}

export function supplementDoseUnit(type: SupplementType, value = 1) {
  if (type !== "MULTIVITAMIN") return "g";
  return value === 1 ? "dose" : "doses";
}

export function supplementProtocolLabel(protocol: SupplementProtocol) {
  return protocol === "LOADING" ? "com fase de carga" : "uso contínuo";
}

export function estimateSupplementProgress(input: SupplementPlanInput) {
  const now = input.now ?? new Date();
  const elapsedDays = Math.max(1, daysInclusive(input.startedAt, now));
  const expectedDose = input.dailyDoseG * elapsedDays;
  const loggedDose = input.logs.reduce((total, log) => total + Math.max(0, log.doseG), 0);
  const periodDose = (input.periods ?? []).reduce((total, period) => total + periodCumulativeDose(period, now), 0);
  const observedDose = loggedDose + periodDose;
  const effectiveDose = input.type === "MULTIVITAMIN"
    ? observedDose
    : observedDose > 0 ? observedDose : expectedDose;
  const targetDose = targetCumulativeDose(input.type, input.protocol, input.dailyDoseG);
  const pct = clamp(Math.round((effectiveDose / targetDose) * 100), 0, 100);
  const adherencePct = clamp(Math.round((observedDose / Math.max(expectedDose, 1)) * 100), 0, 120);
  const daysRemaining = Math.max(0, Math.ceil((targetDose - effectiveDose) / Math.max(input.dailyDoseG, 0.1)));

  return {
    percent: pct,
    elapsedDays,
    daysRemaining,
    loggedDoseG: round(loggedDose),
    periodDoseG: round(periodDose),
    totalDoseG: round(observedDose),
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

  if (type === "BETA_ALANINE") {
    return "Beta-alanina pode causar formigamento, especialmente em doses altas de uma vez. Dividir doses costuma melhorar tolerância.";
  }

  return "Use os valores do rótulo e não exceda a dose indicada. Vitaminas e minerais também podem interagir com medicamentos ou ultrapassar limites seguros.";
}

export function parseSupplementMicronutrients(value: unknown): SupplementMicronutrients {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...emptySupplementMicronutrients };
  }

  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(emptySupplementMicronutrients).map((key) => [key, nonNegativeNumber(source[key])]),
  ) as SupplementMicronutrients;
}

export function sumSupplementMicronutrients(
  plans: Array<{ micronutrientsPerDose: unknown; logs: Array<{ doseG: number }> }>,
) {
  return plans.reduce((total, plan) => {
    const perDose = parseSupplementMicronutrients(plan.micronutrientsPerDose);
    const doses = plan.logs.reduce((sum, log) => sum + Math.max(0, log.doseG), 0);

    for (const key of Object.keys(total) as Array<keyof SupplementMicronutrients>) {
      total[key] = round(total[key] + perDose[key] * doses);
    }
    return total;
  }, { ...emptySupplementMicronutrients });
}

function targetCumulativeDose(type: SupplementType, protocol: SupplementProtocol, dailyDoseG: number) {
  if (type === "CREATINE") {
    return protocol === "LOADING" ? 100 : Math.max(84, dailyDoseG * 28);
  }

  if (type === "MULTIVITAMIN") return Math.max(28, dailyDoseG * 28);

  return Math.max(112, dailyDoseG * 28);
}

function periodCumulativeDose(
  period: { startDate: Date; endDate: Date | null; dailyDoseG: number; adherencePct: number },
  now: Date,
) {
  const endDate = period.endDate && period.endDate < now ? period.endDate : now;
  if (period.startDate > endDate) return 0;
  const days = daysInclusive(period.startDate, endDate);
  const adherence = clamp(period.adherencePct, 0, 100) / 100;
  return Math.max(0, period.dailyDoseG) * days * adherence;
}

function guidanceText(type: SupplementType, protocol: SupplementProtocol, pct: number, daysRemaining: number) {
  if (type === "MULTIVITAMIN") {
    return pct >= 100
      ? "Você completou 28 doses registradas. Continue marcando apenas quando realmente tomar."
      : `${pct}% das primeiras 28 doses foram registradas. O Diário soma os nutrientes somente nos dias confirmados.`;
  }

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
  if (type === "MULTIVITAMIN") {
    if (pct >= 100) return "28 doses registradas";
    if (pct > 0) return "acompanhando";
    return "sem registro";
  }
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

function nonNegativeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
