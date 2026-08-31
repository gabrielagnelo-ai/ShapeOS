import { describe, expect, it } from "vitest";
import { recipeIngredientInputs } from "./recipe-form";

describe("recipe ingredient form", () => {
  it("accepts more than six ingredients without truncating them", () => {
    const formData = new FormData();

    for (let index = 1; index <= 9; index += 1) {
      formData.append("foodId", `food-${index}`);
      formData.append("foodQuery", `Alimento ${index}`);
      formData.append("grams", String(index * 10));
    }

    const ingredients = recipeIngredientInputs(formData);

    expect(ingredients).toHaveLength(9);
    expect(ingredients.at(-1)).toEqual({ foodId: "food-9", foodQuery: "Alimento 9", grams: 90 });
  });

  it("ignores incomplete rows and accepts decimal commas", () => {
    const formData = new FormData();
    formData.append("foodId", "food-1");
    formData.append("foodQuery", "Alimento válido");
    formData.append("grams", "12,5");
    formData.append("foodId", "");
    formData.append("foodQuery", "Linha sem quantidade");
    formData.append("grams", "");

    expect(recipeIngredientInputs(formData)).toEqual([
      { foodId: "food-1", foodQuery: "Alimento válido", grams: 12.5 },
    ]);
  });
});
