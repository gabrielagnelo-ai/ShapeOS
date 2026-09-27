import { appDateInputValue, parseAppDate } from "./date-time";
import { mealNames } from "./meals";

export function diaryDate(value: string, today = appDateInputValue()) {
  if (value < "1900-01-01" || value > today) return null;
  return parseAppDate(value);
}

export function parseDiaryEntry(formData: FormData) {
  const foodId = String(formData.get("foodId") ?? "").trim();
  const grams = Number(String(formData.get("grams") ?? "").replace(",", "."));
  const mealName = String(formData.get("mealName") ?? "");
  const date = diaryDate(String(formData.get("date") ?? ""));
  if (!date) return { error: "Escolha uma data válida, até hoje." } as const;
  if (!foodId) return { error: "Selecione um alimento na lista antes de salvar." } as const;
  if (!Number.isFinite(grams) || grams < 0.1 || grams > 10000) return { error: "Informe uma quantidade entre 0,1 e 10.000 gramas." } as const;
  if (!mealNames.includes(mealName as typeof mealNames[number])) return { error: "Escolha uma refeição da lista." } as const;
  return { foodId, grams, mealName, date } as const;
}
