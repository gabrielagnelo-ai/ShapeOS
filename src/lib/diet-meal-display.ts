export type RecipeTaggedMealItem = {
  id: string;
  recipeBatchId: string | null;
  recipePortions: number | null;
  recipe: { id: string; name: string } | null;
};

export type DietMealDisplayGroup<T extends RecipeTaggedMealItem> = {
  key: string;
  kind: "food" | "recipe";
  name: string;
  portions: number | null;
  recipeBatchId: string | null;
  items: T[];
};

export function groupDietMealItems<T extends RecipeTaggedMealItem>(items: T[]): DietMealDisplayGroup<T>[] {
  const groups = new Map<string, DietMealDisplayGroup<T>>();

  for (const item of items) {
    const isRecipe = Boolean(item.recipeBatchId && item.recipe);
    const key = isRecipe ? `recipe:${item.recipeBatchId}` : `food:${item.id}`;
    const current = groups.get(key);

    if (current) {
      current.items.push(item);
      continue;
    }

    groups.set(key, {
      key,
      kind: isRecipe ? "recipe" : "food",
      name: isRecipe ? item.recipe!.name : "",
      portions: isRecipe ? item.recipePortions : null,
      recipeBatchId: isRecipe ? item.recipeBatchId : null,
      items: [item],
    });
  }

  return [...groups.values()];
}

export function formatRecipePortions(portions: number | null) {
  const value = portions && portions > 0 ? portions : 1;
  const formatted = value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `${formatted} ${value === 1 ? "porção" : "porções"}`;
}
