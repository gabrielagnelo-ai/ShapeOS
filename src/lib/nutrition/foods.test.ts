import { describe, expect, it } from "vitest";
import { nutrientsForGrams, sumNutrients, toFoodNutrients } from "./index";

// A row as Prisma returns it: extra columns, and nutrients the label did not report are null.
const storedOats = {
  id: "food-1",
  category: "Cereais",
  pricePerKg: 18.9,
  name: "Aveia em flocos",
  kcalPer100g: 394,
  proteinPer100g: 13.9,
  carbsPer100g: 66.6,
  fatPer100g: 8.5,
  fiberPer100g: 9.1,
  sodiumPer100g: 5,
  calciumPer100g: 48,
  ironPer100g: 4.4,
  magnesiumPer100g: null,
  potassiumPer100g: null,
  zincPer100g: null,
  vitaminCPer100g: null,
  vitaminDPer100g: null,
  vitaminB12Per100g: null,
};

describe("toFoodNutrients", () => {
  it("keeps the macros and turns missing nutrients into zero", () => {
    expect(toFoodNutrients(storedOats)).toEqual({
      name: "Aveia em flocos",
      kcalPer100g: 394,
      proteinPer100g: 13.9,
      carbsPer100g: 66.6,
      fatPer100g: 8.5,
      fiberPer100g: 9.1,
      sodiumPer100g: 5,
      calciumPer100g: 48,
      ironPer100g: 4.4,
      magnesiumPer100g: 0,
      potassiumPer100g: 0,
      zincPer100g: 0,
      vitaminCPer100g: 0,
      vitaminDPer100g: 0,
      vitaminB12Per100g: 0,
    });
  });

  it("accepts a food selected with only the macros", () => {
    const egg = { name: "Ovo de galinha inteiro", kcalPer100g: 143, proteinPer100g: 13, carbsPer100g: 1.6, fatPer100g: 8.9 };
    expect(nutrientsForGrams(toFoodNutrients(egg), 100)).toMatchObject({ kcal: 143, proteinG: 13, fiberG: 0, sodiumMg: 0 });
  });

  it("gives the same totals as the field-by-field copies it replaces", () => {
    const copied = {
      name: storedOats.name,
      kcalPer100g: storedOats.kcalPer100g,
      proteinPer100g: storedOats.proteinPer100g,
      carbsPer100g: storedOats.carbsPer100g,
      fatPer100g: storedOats.fatPer100g,
      fiberPer100g: storedOats.fiberPer100g ?? 0,
      sodiumPer100g: storedOats.sodiumPer100g ?? 0,
      calciumPer100g: storedOats.calciumPer100g ?? 0,
      ironPer100g: storedOats.ironPer100g ?? 0,
      magnesiumPer100g: storedOats.magnesiumPer100g ?? 0,
      potassiumPer100g: storedOats.potassiumPer100g ?? 0,
      zincPer100g: storedOats.zincPer100g ?? 0,
      vitaminCPer100g: storedOats.vitaminCPer100g ?? 0,
      vitaminDPer100g: storedOats.vitaminDPer100g ?? 0,
      vitaminB12Per100g: storedOats.vitaminB12Per100g ?? 0,
    };
    expect(sumNutrients([{ food: toFoodNutrients(storedOats), grams: 60 }])).toEqual(sumNutrients([{ food: copied, grams: 60 }]));
  });
});
