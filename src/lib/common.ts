/** A number written the Brazilian way, with at most one decimal: 1234.56 → "1.234,6". */
export function formatNumber(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

/** One decimal, rounding half up after scaling. The nutrient math in nutrition/foods.ts uses toFixed on purpose and differs on ties. */
export function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const CONFIDENCE_LABELS: Record<string, string> = { high: "alta", medium: "média", media: "média", low: "baixa" };

/** HIGH/MEDIUM/LOW (profile), high/medium/low (training) or alta/media/baixa (body composition) in Portuguese; anything else is shown as it came. */
export function confidenceLabel(value: string) {
  return CONFIDENCE_LABELS[value.toLowerCase()] ?? value;
}
