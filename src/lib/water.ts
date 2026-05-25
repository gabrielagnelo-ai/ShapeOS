export type WaterPreference = "minimum" | "medium" | "high";

const mlPerKgByPreference: Record<WaterPreference, number> = {
  minimum: 30,
  medium: 35,
  high: 45,
};

export function normalizeWaterPreference(value?: string | null): WaterPreference {
  if (value === "minimum" || value === "medium" || value === "high") return value;
  return "medium";
}

export function waterTargetMl(weightKg: number, preference?: string | null) {
  const normalized = normalizeWaterPreference(preference);
  const mlPerKg = mlPerKgByPreference[normalized];
  const raw = weightKg * mlPerKg;
  return Math.min(7000, Math.max(1500, Math.round(raw / 100) * 100));
}

export function waterPreferenceLabel(preference?: string | null) {
  const labels: Record<WaterPreference, string> = {
    minimum: "Mínimo",
    medium: "Médio",
    high: "Elevado",
  };
  return labels[normalizeWaterPreference(preference)];
}
