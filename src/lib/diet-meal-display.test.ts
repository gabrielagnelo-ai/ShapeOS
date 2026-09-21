import { describe, expect, it } from "vitest";
import { formatRecipePortions, groupDietMealItems } from "./diet-meal-display";

describe("diet meal display", () => {
  it("groups recipe ingredients into one visual entry", () => {
    const groups = groupDietMealItems([
      { id: "1", recipeBatchId: "batch", recipePortions: 1.5, recipe: { id: "r1", name: "Panqueca" } },
      { id: "2", recipeBatchId: "batch", recipePortions: 1.5, recipe: { id: "r1", name: "Panqueca" } },
      { id: "3", recipeBatchId: null, recipePortions: null, recipe: null },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ kind: "recipe", name: "Panqueca", portions: 1.5 });
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1]).toMatchObject({ kind: "food" });
  });

  it("formats portions in Portuguese", () => {
    expect(formatRecipePortions(1)).toBe("1 porção");
    expect(formatRecipePortions(2.5)).toBe("2,5 porções");
  });
});
