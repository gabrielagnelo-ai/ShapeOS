export const baseMealNames = ["Café da manhã", "Almoço", "Pré-treino", "Jantar"] as const;
export const extraMealNames = ["Lanche da manhã", "Lanche da tarde", "Ceia"] as const;
export const mealNames = [...baseMealNames, ...extraMealNames] as const;

const mealAliases = new Map<string, string>([
  ["cafe da manha", "Café da manhã"],
  ["caf? da manh?", "Café da manhã"],
  ["caf� da manh�", "Café da manhã"],
  ["almoco", "Almoço"],
  ["almo?o", "Almoço"],
  ["almo�o", "Almoço"],
  ["pre treino", "Pré-treino"],
  ["pre-treino", "Pré-treino"],
  ["pr? treino", "Pré-treino"],
  ["pr?-treino", "Pré-treino"],
  ["pr� treino", "Pré-treino"],
  ["pr�-treino", "Pré-treino"],
  ["jantar", "Jantar"],
  ["ceia", "Ceia"],
  ["lanche da manha", "Lanche da manhã"],
  ["lanche da tarde", "Lanche da tarde"],
]);

export function normalizeMealName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return mealAliases.get(normalized) ?? name.trim();
}

export function mealOrder(name: string) {
  const index = mealNames.indexOf(normalizeMealName(name) as (typeof mealNames)[number]);
  return index >= 0 ? index + 1 : 99;
}
