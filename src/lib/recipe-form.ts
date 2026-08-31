export type RecipeIngredientInput = {
  foodId: string;
  foodQuery: string;
  grams: number;
};

export function recipeIngredientInputs(formData: Pick<FormData, "getAll">): RecipeIngredientInput[] {
  const foodIds = formData.getAll("foodId");
  const foodQueries = formData.getAll("foodQuery");
  const grams = formData.getAll("grams");
  const rowCount = Math.max(foodIds.length, foodQueries.length, grams.length);

  return Array.from({ length: rowCount }, (_, index) => ({
    foodId: String(foodIds[index] ?? "").trim(),
    foodQuery: String(foodQueries[index] ?? "").trim(),
    grams: parsePositiveNumber(grams[index]),
  })).filter((item) => (item.foodId || item.foodQuery) && item.grams > 0);
}

function parsePositiveNumber(value: FormDataEntryValue | undefined) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
