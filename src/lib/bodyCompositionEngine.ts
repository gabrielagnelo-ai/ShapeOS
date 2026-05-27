export type CompositionCheckin = {
  averageWeightKg: number;
  waistCm?: number | null;
  adherencePct?: number | null;
  sleep?: number | null;
  trainingDone?: boolean | null;
  weekStart: Date;
};

export type CompositionSnapshot = {
  measuredAt: Date;
  weightKg: number;
  waistCm?: number | null;
  bodyFatPct?: number | null;
  leanMassKg?: number | null;
};

export type ProjectionScenario = {
  key: "conservative" | "realistic" | "aggressive";
  label: string;
  estimatedDate: Date | null;
  estimatedWeeks: number | null;
  bodyFatPct: number;
  projectedWeightKg: number | null;
  projectedLeanMassKg: number | null;
  confidence: "alta" | "media" | "baixa";
};

export function estimateLeanMass(weightKg: number, bodyFatPct?: number | null) {
  if (!weightKg || bodyFatPct == null) return null;
  return round1(weightKg * (1 - bodyFatPct / 100));
}

export function estimateFatMass(weightKg: number, bodyFatPct?: number | null) {
  if (!weightKg || bodyFatPct == null) return null;
  return round1(weightKg * (bodyFatPct / 100));
}

export function projectedWeightByBodyFat(leanMassKg: number, targetBodyFatPct: number) {
  if (!leanMassKg || targetBodyFatPct <= 0 || targetBodyFatPct >= 50) return null;
  return round1(leanMassKg / (1 - targetBodyFatPct / 100));
}

export function buildBodyCompositionProjection(input: {
  currentWeightKg: number;
  currentWaistCm?: number | null;
  currentBodyFatPct?: number | null;
  targetBodyFatPct?: number | null;
  targetWaistCm?: number | null;
  targetDate?: Date | null;
  checkins: CompositionCheckin[];
  snapshots: CompositionSnapshot[];
  proteinHitRate?: number | null;
  deficitPct?: number | null;
}) {
  const currentLeanMassKg = estimateLeanMass(input.currentWeightKg, input.currentBodyFatPct);
  const currentFatMassKg = estimateFatMass(input.currentWeightKg, input.currentBodyFatPct);
  const targetBodyFatPct = input.targetBodyFatPct ?? null;
  const trends = buildTrends(input);
  const confidenceScore = bodyDataConfidence({
    checkins: input.checkins,
    snapshots: input.snapshots,
    hasWaist: Boolean(input.currentWaistCm),
    hasBodyFat: input.currentBodyFatPct != null,
  });
  const recomposition = detectRecomposition({
    weightTrendKgPerWeek: trends.weightKgPerWeek,
    waistTrendCmPerWeek: trends.waistCmPerWeek,
    bodyFatTrendPctPerWeek: trends.bodyFatPctPerWeek,
    trainingFrequency: trends.trainingFrequency,
  });
  const muscleSignal = musclePreservationSignal({
    proteinHitRate: input.proteinHitRate ?? null,
    adherenceAverage: average(input.checkins.map((item) => item.adherencePct).filter((value): value is number => typeof value === "number")),
    trainingFrequency: trends.trainingFrequency,
    sleepAverage: trends.sleepAverage,
    deficitPct: input.deficitPct ?? null,
  });
  const scenarios = targetBodyFatPct && currentLeanMassKg
    ? buildScenarios({
        currentBodyFatPct: input.currentBodyFatPct ?? targetBodyFatPct,
        targetBodyFatPct,
        currentLeanMassKg,
        confidenceScore,
        muscleSignal,
        bfTrendPctPerWeek: trends.bodyFatPctPerWeek,
      })
    : [];
  const targetFatMassKg = targetBodyFatPct && currentLeanMassKg ? estimateTargetFatMass(currentLeanMassKg, targetBodyFatPct) : null;
  const fatMassToLoseKg = currentFatMassKg != null && targetFatMassKg != null ? round1(Math.max(0, currentFatMassKg - targetFatMassKg)) : null;
  const probableWeightRangeKg = probableWeightRange(scenarios);
  const bodyFatProgress = buildBodyFatProgress({
    currentBodyFatPct: input.currentBodyFatPct ?? null,
    targetBodyFatPct,
    snapshots: input.snapshots,
  });

  return {
    hasGoal: Boolean(targetBodyFatPct || input.targetWaistCm),
    currentLeanMassKg,
    currentFatMassKg,
    targetBodyFatPct,
    targetWeightKg: targetBodyFatPct && currentLeanMassKg ? projectedWeightByBodyFat(currentLeanMassKg, targetBodyFatPct) : null,
    targetFatMassKg,
    fatMassToLoseKg,
    probableWeightRangeKg,
    bodyFatProgress,
    trends,
    confidenceScore,
    confidenceLabel: confidenceLabel(confidenceScore),
    recomposition,
    muscleSignal,
    scenarios,
    primaryMessage: primaryMessage({ recomposition, scenarios, targetBodyFatPct }),
  };
}

function estimateTargetFatMass(leanMassKg: number, targetBodyFatPct: number) {
  const targetWeight = projectedWeightByBodyFat(leanMassKg, targetBodyFatPct);
  return targetWeight == null ? null : round1(targetWeight * (targetBodyFatPct / 100));
}

function probableWeightRange(scenarios: ProjectionScenario[]) {
  const weights = scenarios.map((scenario) => scenario.projectedWeightKg).filter((value): value is number => typeof value === "number");
  if (!weights.length) return null;
  const min = Math.floor((Math.min(...weights) - 1.2) * 10) / 10;
  const max = Math.ceil((Math.max(...weights) + 1.2) * 10) / 10;
  return { minKg: min, maxKg: max };
}

function buildBodyFatProgress(input: {
  currentBodyFatPct: number | null;
  targetBodyFatPct: number | null;
  snapshots: CompositionSnapshot[];
}) {
  if (input.currentBodyFatPct == null || input.targetBodyFatPct == null) {
    return { startBodyFatPct: null, currentBodyFatPct: input.currentBodyFatPct, targetBodyFatPct: input.targetBodyFatPct, progressPct: 0 };
  }
  const orderedSnapshots = [...input.snapshots]
    .filter((snapshot) => snapshot.bodyFatPct != null)
    .sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());
  const startBodyFatPct = orderedSnapshots[0]?.bodyFatPct ?? input.currentBodyFatPct;
  const totalDropNeeded = Math.max(0.1, startBodyFatPct - input.targetBodyFatPct);
  const achievedDrop = Math.max(0, startBodyFatPct - input.currentBodyFatPct);

  return {
    startBodyFatPct: round1(startBodyFatPct),
    currentBodyFatPct: round1(input.currentBodyFatPct),
    targetBodyFatPct: round1(input.targetBodyFatPct),
    progressPct: Math.round(clamp((achievedDrop / totalDropNeeded) * 100, 0, 100)),
  };
}

function buildScenarios(input: {
  currentBodyFatPct: number;
  targetBodyFatPct: number;
  currentLeanMassKg: number;
  confidenceScore: number;
  muscleSignal: ReturnType<typeof musclePreservationSignal>;
  bfTrendPctPerWeek: number | null;
}): ProjectionScenario[] {
  const remainingBf = Math.max(0, input.currentBodyFatPct - input.targetBodyFatPct);
  const baseRate = Math.abs(input.bfTrendPctPerWeek ?? 0) >= 0.15 ? Math.abs(input.bfTrendPctPerWeek!) : 0.35;
  const lowBfDrag = input.targetBodyFatPct < 15 ? 0.72 : input.targetBodyFatPct < 18 ? 0.85 : 1;
  const confidenceDrag = input.confidenceScore < 45 ? 0.8 : input.confidenceScore < 70 ? 0.9 : 1;
  const scenarioDefs = [
    { key: "conservative" as const, label: "Conservador", rate: baseRate * 0.7 * lowBfDrag * confidenceDrag, leanShift: input.muscleSignal.leanMassShiftKg - 0.5 },
    { key: "realistic" as const, label: "Realista", rate: baseRate * lowBfDrag * confidenceDrag, leanShift: input.muscleSignal.leanMassShiftKg },
    { key: "aggressive" as const, label: "Agressivo", rate: baseRate * 1.35 * lowBfDrag * confidenceDrag, leanShift: input.muscleSignal.leanMassShiftKg - 1.1 },
  ];

  return scenarioDefs.map((scenario) => {
    const weeks = remainingBf <= 0 ? 0 : Math.ceil(remainingBf / Math.max(0.1, scenario.rate));
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + weeks * 7);
    const projectedLeanMassKg = round1(Math.max(0, input.currentLeanMassKg + scenario.leanShift));
    const projectedWeightKg = projectedWeightByBodyFat(projectedLeanMassKg, input.targetBodyFatPct);
    const confidencePenalty = scenario.key === "aggressive" ? 18 : scenario.key === "conservative" ? -6 : 0;

    return {
      key: scenario.key,
      label: scenario.label,
      estimatedDate,
      estimatedWeeks: weeks,
      bodyFatPct: input.targetBodyFatPct,
      projectedWeightKg,
      projectedLeanMassKg,
      confidence: confidenceLabel(input.confidenceScore - confidencePenalty),
    };
  });
}

function buildTrends(input: {
  checkins: CompositionCheckin[];
  snapshots: CompositionSnapshot[];
}) {
  const orderedCheckins = [...input.checkins].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  const orderedSnapshots = [...input.snapshots].sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());
  const trainingDone = orderedCheckins.filter((checkin) => checkin.trainingDone).length;

  return {
    weightKgPerWeek: trend(orderedCheckins.map((item) => ({ date: item.weekStart, value: item.averageWeightKg }))),
    waistCmPerWeek: trend(orderedCheckins.filter((item) => item.waistCm != null).map((item) => ({ date: item.weekStart, value: item.waistCm! }))),
    bodyFatPctPerWeek: trend(orderedSnapshots.filter((item) => item.bodyFatPct != null).map((item) => ({ date: item.measuredAt, value: item.bodyFatPct! }))),
    leanMassKgPerWeek: trend(orderedSnapshots.filter((item) => item.leanMassKg != null).map((item) => ({ date: item.measuredAt, value: item.leanMassKg! }))),
    trainingFrequency: orderedCheckins.length ? trainingDone / orderedCheckins.length : null,
    sleepAverage: average(orderedCheckins.map((item) => item.sleep).filter((value): value is number => typeof value === "number")),
  };
}

function detectRecomposition(input: {
  weightTrendKgPerWeek: number | null;
  waistTrendCmPerWeek: number | null;
  bodyFatTrendPctPerWeek: number | null;
  trainingFrequency: number | null;
}) {
  const weightStable = input.weightTrendKgPerWeek == null || Math.abs(input.weightTrendKgPerWeek) <= 0.25;
  const waistFalling = (input.waistTrendCmPerWeek ?? 0) <= -0.3;
  const bfFalling = input.bodyFatTrendPctPerWeek == null || input.bodyFatTrendPctPerWeek <= -0.15;
  const trainingOk = input.trainingFrequency == null || input.trainingFrequency >= 0.5;
  const detected = weightStable && waistFalling && bfFalling && trainingOk;

  return {
    detected,
    message: detected
      ? "Possível recomposição corporal detectada: cintura caindo com peso estável."
      : "Sem recomposição clara ainda. Continue registrando cintura, BF e treino.",
  };
}

function musclePreservationSignal(input: {
  proteinHitRate: number | null;
  adherenceAverage: number | null;
  trainingFrequency: number | null;
  sleepAverage: number | null;
  deficitPct: number | null;
}) {
  let score = 0;
  if ((input.proteinHitRate ?? 0) >= 0.8) score += 35;
  if ((input.trainingFrequency ?? 0) >= 0.5) score += 30;
  if ((input.sleepAverage ?? 0) >= 7) score += 20;
  if ((input.adherenceAverage ?? 0) >= 80) score += 10;
  if ((input.deficitPct ?? 0) <= 20) score += 15;
  if ((input.deficitPct ?? 0) >= 28) score -= 20;

  const leanMassShiftKg = score >= 80 ? 0.6 : score >= 55 ? 0 : score >= 35 ? -0.6 : -1.2;

  return {
    score: clamp(score, 0, 100),
    leanMassShiftKg,
    label: score >= 80 ? "boa preservação muscular" : score >= 55 ? "preservação provável" : "risco de perda muscular",
  };
}

function bodyDataConfidence(input: {
  checkins: CompositionCheckin[];
  snapshots: CompositionSnapshot[];
  hasWaist: boolean;
  hasBodyFat: boolean;
}) {
  let score = 0;
  score += Math.min(30, input.checkins.length * 6);
  score += Math.min(25, input.snapshots.filter((snapshot) => snapshot.bodyFatPct != null).length * 8);
  score += input.hasWaist ? 20 : 0;
  score += input.hasBodyFat ? 20 : 0;
  score += input.checkins.length >= 4 ? 5 : 0;
  return clamp(score, 0, 100);
}

function trend(points: Array<{ date: Date; value: number }>) {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const weeks = Math.max(1, (last.date.getTime() - first.date.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return (last.value - first.value) / weeks;
}

function primaryMessage(input: {
  recomposition: ReturnType<typeof detectRecomposition>;
  scenarios: ProjectionScenario[];
  targetBodyFatPct: number | null;
}) {
  if (input.recomposition.detected) return "Seu físico está mudando mesmo sem grande queda de peso.";
  const realistic = input.scenarios.find((scenario) => scenario.key === "realistic");
  if (realistic && input.targetBodyFatPct) {
    return `Seu ritmo atual é compatível com cerca de ${input.targetBodyFatPct}% BF até ${realistic.estimatedDate?.toLocaleDateString("pt-BR")}.`;
  }
  return "Defina um BF alvo e registre cintura para projetar como seu físico pode ficar.";
}

function confidenceLabel(score: number) {
  if (score >= 72) return "alta" as const;
  if (score >= 45) return "media" as const;
  return "baixa" as const;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
