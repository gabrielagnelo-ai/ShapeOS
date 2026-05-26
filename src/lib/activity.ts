export type ActivityPreset = {
  key: string;
  name: string;
  met: number;
  intensity: "leve" | "moderado" | "alto";
  category: ActivityCategory;
};

export type ActivityEffort = "light" | "moderate" | "hard";
export type ActivityCategory = "strength" | "walking" | "cardio" | "sport" | "custom";

export const activityEfforts: Array<{
  key: ActivityEffort;
  label: string;
  helper: string;
  multiplier: number;
}> = [
  {
    key: "light",
    label: "Leve",
    helper: "Dava para conversar normal",
    multiplier: 0.85,
  },
  {
    key: "moderate",
    label: "Moderada",
    helper: "Respiracao mais forte, mas controlada",
    multiplier: 1,
  },
  {
    key: "hard",
    label: "Forte",
    helper: "Dificil manter conversa",
    multiplier: 1.18,
  },
];

export const activityPresets: ActivityPreset[] = [
  { key: "walk_light", name: "Caminhada leve", met: 3.0, intensity: "leve", category: "walking" },
  { key: "walk_fast", name: "Caminhada rapida", met: 4.3, intensity: "moderado", category: "walking" },
  { key: "bike_moderate", name: "Bicicleta moderada", met: 6.8, intensity: "moderado", category: "cardio" },
  { key: "run_light", name: "Corrida leve", met: 8.3, intensity: "alto", category: "cardio" },
  { key: "run_fast", name: "Corrida forte", met: 11.5, intensity: "alto", category: "cardio" },
  { key: "weight_training", name: "Musculacao", met: 5.0, intensity: "moderado", category: "strength" },
  { key: "heavy_lifting", name: "Musculacao pesada", met: 6.0, intensity: "alto", category: "strength" },
  { key: "hiit", name: "HIIT / funcional intenso", met: 8.0, intensity: "alto", category: "cardio" },
  { key: "soccer", name: "Futebol", met: 7.0, intensity: "alto", category: "sport" },
  { key: "swimming", name: "Natacao moderada", met: 5.8, intensity: "moderado", category: "cardio" },
  { key: "stairs", name: "Escada / subida", met: 8.8, intensity: "alto", category: "cardio" },
  { key: "custom", name: "Outra atividade", met: 5.0, intensity: "moderado", category: "custom" },
];

export function estimateActivityCalories(input: { met: number; weightKg: number; durationMinutes: number }) {
  if (input.met <= 0 || input.weightKg <= 0 || input.durationMinutes <= 0) return 0;
  return Math.round(input.met * input.weightKg * (input.durationMinutes / 60));
}

export function findActivityPreset(key: string) {
  return activityPresets.find((preset) => preset.key === key) ?? activityPresets[0];
}

export function findActivityEffort(key: string) {
  return activityEfforts.find((effort) => effort.key === key) ?? activityEfforts[1];
}

export function estimateMetByEffort(presetMet: number, effortKey: string) {
  const effort = findActivityEffort(effortKey);
  return Number((presetMet * effort.multiplier).toFixed(1));
}

export function activityCategory(activityKey: string) {
  return findActivityPreset(activityKey).category;
}

export function conservativeActivityFactor(input: { activityKey: string; source?: string | null }) {
  if (input.source === "apple_watch" || input.source === "apple_health") return 0.9;

  const category = activityCategory(input.activityKey);
  if (category === "strength") return 0.7;
  if (category === "walking") return 0.85;
  if (category === "cardio" || category === "sport") return 0.85;
  return 0.8;
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
