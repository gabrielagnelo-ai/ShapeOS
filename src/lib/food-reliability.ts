export type DietaryProfile = { allergies: string[]; restrictions: string[]; dislikedFoods?: string[] };
export type MealDraft = { name: string; items: { foodName: string; grams: number }[] };
export type PlanFood = { id: string; name: string; kcalPer100g: number };

export const foodReliabilityMessages: Record<string, string> = {
  "allergy-review": "Seu perfil informa alergias. A base não contém composição e traços de alérgenos verificados. Use um plano manual revisado com seu profissional; a geração e ativação automáticas estão suspensas.",
  "restriction-review": "Uma restrição do perfil exige revisão da composição dos alimentos. Use um plano manual revisado; não conseguimos confirmar essa restrição automaticamente.",
  "food-conflict": "Este plano contém alimentos incompatíveis com suas preferências ou restrições. Revise os ingredientes antes de ativar.",
  "insufficient-foods": "Não há alimentos compatíveis suficientes para montar esse plano. Revise suas preferências ou monte um plano manual.",
  "invalid-target": "Não foi possível ajustar as porções à sua meta com segurança. Revise as metas ou monte o plano manualmente.",
  "ai-unavailable": "A IA não conseguiu gerar uma resposta válida. Nada foi salvo. Tente novamente ou preencha os ingredientes manualmente.",
  "invalid-ingredients": "Um ou mais ingredientes não foram identificados com precisão. Selecione cada alimento da lista e confira as quantidades; nada foi salvo.",
  "plan-created": "Plano criado com calorias ajustadas à meta. Confira porções, distribuição de macros e adequação à sua rotina antes de seguir.",
  "recipe-created": "Receita salva. Revise ingredientes e porções antes de registrar no diário.",
  "recipe-updated": "Receita atualizada.",
  "recipe-estimated": "Estimativa salva para revisão. Confira os ingredientes e as porções antes de lançar no diário.",
  "recipe-logged": "Porção adicionada ao diário de hoje.",
  "recipe-planned": "Porção adicionada ao plano ativo.",
};

export function normalizeDietText(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const absent = new Set(["", "nenhum", "nenhuma", "nao", "sem restricoes", "sem alergias", "none"]);
export function declaredDietEntries(values: string[]) {
  return values.map(normalizeDietText).filter((value) => !absent.has(value));
}

function restrictionKind(value: string) {
  if (["vegano", "vegana", "vegan", "veganismo"].includes(value)) return "vegan";
  if (["vegetariano", "vegetariana", "vegetarianismo", "ovolactovegetariano", "ovolactovegetariana"].includes(value)) return "vegetarian";
  return null;
}

// Food has no verified ingredient/allergen metadata. Names cannot certify allergy,
// gluten/lactose absence, cross-contact or arbitrary free-text restrictions.
export function dietaryReviewIssue(profile: DietaryProfile): string | null {
  if (declaredDietEntries(profile.allergies).length) return "allergy-review";
  if (declaredDietEntries(profile.restrictions).some((entry) => !restrictionKind(entry))) return "restriction-review";
  return null;
}

const plantFoods = new Set([
  "arroz branco cozido", "arroz integral cozido", "feijao carioca cozido", "feijao preto cozido",
  "aveia em flocos", "banana prata", "batata doce cozida", "batata inglesa cozida", "brocolis cozido",
  "lentilha cozida", "grao de bico cozido", "azeite de oliva", "abacate", "maca", "mamao papaia",
]);
const vegetarianFoods = new Set(["ovo de galinha inteiro", "leite integral", "leite desnatado", "iogurte natural", "queijo minas frescal"]);

export function foodAllowedForProfile(foodName: string, profile: DietaryProfile) {
  if (dietaryReviewIssue(profile)) return false;
  const name = normalizeDietText(foodName);
  if (declaredDietEntries(profile.dislikedFoods ?? []).some((entry) => name.includes(entry))) return false;
  const restrictions = declaredDietEntries(profile.restrictions).map(restrictionKind);
  if (!restrictions.length) return true;
  return plantFoods.has(name) || (!restrictions.includes("vegan") && vegetarianFoods.has(name));
}

export function planCompatibilityIssue(foodNames: string[], profile: DietaryProfile) {
  return dietaryReviewIssue(profile) ?? (foodNames.some((name) => !foodAllowedForProfile(name, profile)) ? "food-conflict" : null);
}

// Explicit acknowledgement permits a manual workflow only; it never changes the
// automated generation policy or overrides known ingredient conflicts.
export function manualPlanCompatibilityIssue(foodNames: string[], profile: DietaryProfile, confirmedReview: boolean) {
  const review = dietaryReviewIssue(profile);
  if (review && !confirmedReview) return review;
  const checkable = { ...profile, allergies: [], restrictions: declaredDietEntries(profile.restrictions).filter((value) => restrictionKind(value)) };
  return foodNames.some((name) => !foodAllowedForProfile(name, checkable)) ? "food-conflict" : null;
}

export const starterMealDrafts: MealDraft[] = [
  { name: "Café da manhã", items: [{ foodName: "Aveia em flocos", grams: 60 }, { foodName: "Banana prata", grams: 100 }, { foodName: "Ovo de galinha inteiro", grams: 100 }] },
  { name: "Almoço", items: [{ foodName: "Arroz branco cozido", grams: 180 }, { foodName: "Feijao carioca cozido", grams: 120 }, { foodName: "Peito de frango grelhado", grams: 180 }] },
  { name: "Pré-treino", items: [{ foodName: "Banana prata", grams: 120 }, { foodName: "Aveia em flocos", grams: 30 }] },
  { name: "Jantar", items: [{ foodName: "Tilapia grelhada", grams: 180 }, { foodName: "Batata doce cozida", grams: 220 }, { foodName: "Feijao carioca cozido", grams: 80 }] },
  { name: "Ceia", items: [{ foodName: "Banana prata", grams: 100 }, { foodName: "Ovo de galinha inteiro", grams: 100 }] },
];

export function starterMealsForNames(names: string[]): MealDraft[] {
  const snack = starterMealDrafts.find((meal) => meal.name === "Pré-treino")!;
  return [...new Set(names)].map((name) => ({
    name,
    items: (starterMealDrafts.find((meal) => meal.name === name) ?? snack).items.map((item) => ({ ...item })),
  }));
}

export function prepareCalorieMatchedPlan(meals: MealDraft[], foods: PlanFood[], profile: DietaryProfile, calories: number): { meals: MealDraft[]; issue: null } | { meals: null; issue: string } {
  const issue = dietaryReviewIssue(profile);
  if (issue) return { meals: null, issue };
  if (!Number.isFinite(calories) || calories < 1000 || calories > 6000) return { meals: null, issue: "invalid-target" };
  const byName = new Map(foods.map((food) => [food.name, food]));
  const filtered = meals.map((meal) => ({ ...meal, items: meal.items.filter((item) => {
    const food = byName.get(item.foodName);
    return food && food.kcalPer100g > 0 && Number.isFinite(food.kcalPer100g) && foodAllowedForProfile(item.foodName, profile) && Number.isFinite(item.grams) && item.grams > 0;
  }) }));
  if (!filtered.length || filtered.some((meal) => !meal.items.length)) return { meals: null, issue: "insufficient-foods" };
  const total = filtered.flatMap((meal) => meal.items).reduce((sum, item) => sum + item.grams * byName.get(item.foodName)!.kcalPer100g / 100, 0);
  const ratio = calories / total;
  const adjusted = filtered.map((meal) => ({ ...meal, items: meal.items.map((item) => ({ ...item, grams: Math.round(item.grams * ratio * 10) / 10 })) }));
  if (ratio < 0.3 || ratio > 3 || adjusted.some((meal) => meal.items.some((item) => item.grams < 1 || item.grams > 800))) return { meals: null, issue: "invalid-target" };
  return { meals: adjusted, issue: null };
}

export type AiRecipeDraft = { name: string; servings: number; instructions?: string; items: { foodName: string; grams: number }[] };
export function parseVerifiedRecipe(text: string, allowedNames: Set<string>): AiRecipeDraft | null {
  try {
    const recipe = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) as AiRecipeDraft;
    if (typeof recipe.name !== "string" || !recipe.name.trim() || recipe.name.length > 200 || !Number.isInteger(recipe.servings) || recipe.servings < 1 || recipe.servings > 100 || !Array.isArray(recipe.items) || !recipe.items.length || recipe.items.length > 40) return null;
    if (recipe.instructions !== undefined && typeof recipe.instructions !== "string") return null;
    if (recipe.items.some((item) => !item || !allowedNames.has(item.foodName) || !Number.isFinite(item.grams) || item.grams <= 0 || item.grams > 10000)) return null;
    return recipe;
  } catch { return null; }
}
