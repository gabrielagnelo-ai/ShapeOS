export type GoalProjectionCheckin = {
  averageWeightKg: number;
  waistCm?: number | null;
  weekStart: Date;
};

export type BodyGoalInput = {
  currentWeightKg: number;
  currentWaistCm?: number | null;
  currentBodyFatPct?: number | null;
  targetWeightKg?: number | null;
  targetWaistCm?: number | null;
  targetBodyFatPct?: number | null;
  targetDate?: Date | null;
  checkins: GoalProjectionCheckin[];
};

export function buildBodyGoalProjection(input: BodyGoalInput) {
  const weightTrend = weeklyTrend(input.checkins.map((checkin) => ({ date: checkin.weekStart, value: checkin.averageWeightKg })));
  const waistTrend = weeklyTrend(
    input.checkins
      .filter((checkin) => typeof checkin.waistCm === "number")
      .map((checkin) => ({ date: checkin.weekStart, value: checkin.waistCm! })),
  );
  const weightRate = meaningfulRate(weightTrend, conservativeWeightRate(input.currentWeightKg, input.targetWeightKg));
  const waistRate = meaningfulRate(waistTrend, input.targetWaistCm && input.currentWaistCm ? conservativeWaistRate(input.currentWaistCm, input.targetWaistCm) : null);
  const weightEta = etaForTarget({
    current: input.currentWeightKg,
    target: input.targetWeightKg,
    weeklyRate: weightRate,
  });
  const waistEta = etaForTarget({
    current: input.currentWaistCm,
    target: input.targetWaistCm,
    weeklyRate: waistRate,
  });
  const mainEta = chooseMainEta(weightEta, waistEta);
  const desiredWeeks = input.targetDate ? weeksBetween(new Date(), input.targetDate) : null;

  return {
    hasGoal: Boolean(input.targetWeightKg || input.targetWaistCm || input.targetBodyFatPct),
    weightTrendKgPerWeek: weightTrend,
    waistTrendCmPerWeek: waistTrend,
    weightEta,
    waistEta,
    estimatedDate: mainEta?.date ?? null,
    estimatedWeeks: mainEta?.weeks ?? null,
    paceLabel: paceLabel({ estimatedWeeks: mainEta?.weeks ?? null, desiredWeeks }),
    desiredWeeks,
  };
}

function weeklyTrend(points: Array<{ date: Date; value: number }>) {
  if (points.length < 2) return null;
  const ordered = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const weeks = weeksBetween(first.date, last.date);
  return weeks > 0 ? (last.value - first.value) / weeks : null;
}

function conservativeWeightRate(current: number, target?: number | null) {
  if (!target || !current || target === current) return null;
  const direction = target < current ? -1 : 1;
  return direction * Math.max(0.25, current * 0.005);
}

function conservativeWaistRate(current: number, target: number) {
  if (target === current) return null;
  return target < current ? -0.5 : 0.5;
}

function meaningfulRate(realRate: number | null, fallback: number | null) {
  if (realRate && Math.abs(realRate) >= 0.05) return realRate;
  return fallback;
}

function etaForTarget(input: { current?: number | null; target?: number | null; weeklyRate: number | null }) {
  if (!input.current || !input.target || !input.weeklyRate) return null;
  const remaining = input.target - input.current;
  if (Math.abs(remaining) < 0.1) return { weeks: 0, date: new Date(), remaining };
  if (Math.sign(remaining) !== Math.sign(input.weeklyRate)) return null;
  const weeks = Math.ceil(Math.abs(remaining / input.weeklyRate));
  const date = new Date();
  date.setDate(date.getDate() + weeks * 7);
  return { weeks, date, remaining };
}

function chooseMainEta<T extends { weeks: number; date: Date }>(...etas: Array<T | null>) {
  const valid = etas.filter(Boolean) as T[];
  if (!valid.length) return null;
  return valid.sort((a, b) => b.weeks - a.weeks)[0];
}

function paceLabel(input: { estimatedWeeks: number | null; desiredWeeks: number | null }) {
  if (input.estimatedWeeks == null) return "precisa de mais dados";
  if (input.desiredWeeks == null) return "prazo estimado";
  if (input.estimatedWeeks <= input.desiredWeeks) return "dentro do prazo";
  if (input.estimatedWeeks <= input.desiredWeeks * 1.25) return "um pouco acima do prazo";
  return "prazo agressivo";
}

function weeksBetween(start: Date, end: Date) {
  return Math.max(0, (end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
}
