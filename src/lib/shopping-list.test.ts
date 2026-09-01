import { describe, expect, it } from "vitest";
import {
  LEAN_COOKED_PORK_LEG_FOOD_ID,
  isWholeChickenEgg,
  shoppingListConversion,
  wholeEggPricePerKg,
  wholeEggUnitCount,
  wholeEggUnitPrice,
} from "./shopping-list";

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

  it("converts whole chicken eggs to 53 g purchase units", () => {
    const result = shoppingListConversion({
      foodId: "taco-488",
      name: "Ovo de galinha inteiro cozido/10minutos",
      category: "Ovos e derivados",
      readyGrams: 700,
    });

    expect(result.isWholeChickenEgg).toBe(true);
    expect(result.gramsPerUnit).toBe(53);
    expect(result.unitLabel).toBe("unidade");
    expect(wholeEggUnitCount(result.buyGrams)).toBe(14);
  });

  it("does not treat whites, yolks, quail eggs or omelets as whole chicken eggs", () => {
    expect(isWholeChickenEgg({ foodId: "clara-de-ovo", name: "Clara de ovo" })).toBe(false);
    expect(isWholeChickenEgg({ foodId: "taco-485", name: "Ovo, de codorna, inteiro, cru" })).toBe(false);
    expect(isWholeChickenEgg({ foodId: "taco-487", name: "Ovo, de galinha, gema, cozida" })).toBe(false);
    expect(isWholeChickenEgg({ foodId: "taco-484", name: "Omelete, de queijo" })).toBe(false);
  });

  it("converts egg prices between kg storage and unit display", () => {
    expect(wholeEggUnitPrice(10)).toBeCloseTo(0.53, 5);
    expect(wholeEggPricePerKg(0.75)).toBeCloseTo(14.150943, 5);
    expect(wholeEggUnitPrice(wholeEggPricePerKg(0.75))).toBeCloseTo(0.75, 5);
  });
});
