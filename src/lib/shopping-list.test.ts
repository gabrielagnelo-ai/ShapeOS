import { describe, expect, it } from "vitest";
import { LEAN_COOKED_PORK_LEG_FOOD_ID, shoppingListConversion } from "./shopping-list";

describe("shopping list conversion", () => {
  it("converts 3,100 g of cooked lean pork leg to its raw purchase weight", () => {
    const result = shoppingListConversion({
      foodId: LEAN_COOKED_PORK_LEG_FOOD_ID,
      name: "Pernil de porco magro cozido",
      category: "Carnes",
      readyGrams: 3100,
    });

    expect(result.buyGrams).toBeCloseTo(4509.09, 2);
    expect(result.isLeanCookedPorkLeg).toBe(true);
  });

  it("converts 1,500 g of cooked lean pork leg to its raw purchase weight", () => {
    const result = shoppingListConversion({
      foodId: LEAN_COOKED_PORK_LEG_FOOD_ID,
      name: "Pernil de porco magro cozido",
      category: "Carnes",
      readyGrams: 1500,
    });

    expect(result.buyGrams).toBeCloseTo(2181.82, 2);
  });

  it("keeps the existing conversion for every other food", () => {
    const unchangedFood = shoppingListConversion({
      foodId: "another-food-id",
      name: "Banana prata",
      category: "Frutas",
      readyGrams: 3100,
    });
    const similarPorkFood = shoppingListConversion({
      foodId: "taco-435",
      name: "Porco, pernil, assado",
      category: "Numero do",
      readyGrams: 3100,
    });

    expect(unchangedFood.buyGrams).toBe(3100);
    expect(unchangedFood.isLeanCookedPorkLeg).toBe(false);
    expect(similarPorkFood.buyGrams).toBeCloseTo(4133.33, 2);
    expect(similarPorkFood.isLeanCookedPorkLeg).toBe(false);
  });
});
