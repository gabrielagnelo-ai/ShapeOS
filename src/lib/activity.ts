export type ActivityPreset = {
  key: string;
  name: string;
  met: number;
  intensity: "leve" | "moderado" | "alto";
};

export const activityPresets: ActivityPreset[] = [
  { key: "walk_light", name: "Caminhada leve", met: 3.0, intensity: "leve" },
  { key: "walk_fast", name: "Caminhada rápida", met: 4.3, intensity: "moderado" },
  { key: "bike_moderate", name: "Bicicleta moderada", met: 6.8, intensity: "moderado" },
  { key: "run_light", name: "Corrida leve", met: 8.3, intensity: "alto" },
  { key: "run_fast", name: "Corrida forte", met: 11.5, intensity: "alto" },
  { key: "weight_training", name: "Musculação", met: 5.0, intensity: "moderado" },
  { key: "heavy_lifting", name: "Musculação pesada", met: 6.0, intensity: "alto" },
  { key: "hiit", name: "HIIT / funcional intenso", met: 8.0, intensity: "alto" },
  { key: "soccer", name: "Futebol", met: 7.0, intensity: "alto" },
  { key: "swimming", name: "Natação moderada", met: 5.8, intensity: "moderado" },
  { key: "stairs", name: "Escada / subida", met: 8.8, intensity: "alto" },
  { key: "custom", name: "Personalizado", met: 5.0, intensity: "moderado" },
];

export function estimateActivityCalories(input: { met: number; weightKg: number; durationMinutes: number }) {
  if (input.met <= 0 || input.weightKg <= 0 || input.durationMinutes <= 0) return 0;
  return Math.round(input.met * input.weightKg * (input.durationMinutes / 60));
}

export function findActivityPreset(key: string) {
  return activityPresets.find((preset) => preset.key === key) ?? activityPresets[0];
}

export function tdeeCheck(input: { estimatedTdee: number; loggedActivityKcal: number; baselineActivityKcal?: number }) {
  const baselineActivityKcal = input.baselineActivityKcal ?? 0;
  const checkedTdee = Math.round(input.estimatedTdee - baselineActivityKcal + input.loggedActivityKcal);
  const delta = checkedTdee - input.estimatedTdee;
  return {
    checkedTdee,
    delta,
    label: delta > 150 ? "dia mais ativo" : delta < -150 ? "dia menos ativo" : "dentro do esperado",
  };
}
