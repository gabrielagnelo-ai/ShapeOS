import { describe, expect, it } from "vitest";
import {
  averageDailyMenuNutrition,
  consolidateShoppingList,
  menuDaysSummary,
  parseMenuEntryDays,
  shoppingItemCost,
  type ShoppingFood,
} from "./diet-menu";
import { LEAN_COOKED_PORK_LEG_FOOD_ID, wholeEggUnitCount, wholeEggUnitPrice } from "./shopping-list";

const rice: ShoppingFood = { id: "rice", name: "Arroz branco cozido", category: "Cereais", pricePerKg: 10 };
const chicken: ShoppingFood = { id: "chicken", name: "Frango grelhado", category: "Carnes", pricePerKg: 30 };
const banana: ShoppingFood = { id: "banana", name: "Banana prata", category: "Frutas", pricePerKg: null };
const egg: ShoppingFood = { id: "taco-488", name: "Ovo de galinha inteiro cozido", category: "Ovos e derivados", pricePerKg: 20 };
const porkLeg: ShoppingFood = { id: LEAN_COOKED_PORK_LEG_FOOD_ID, name: "Pernil de porco magro cozido", category: "Carnes", pricePerKg: 25 };

const plan1 = [{ grams: 150, food: rice }];
const plan2 = [{ grams: 100, food: rice }, { grams: 200, food: chicken }];
const plan3 = [{ grams: 120, food: banana }];

function byName(items: ReturnType<typeof consolidateShoppingList>["items"], name: string) {
  const item = items.find((entry) => entry.name === name);
  if (!item) throw new Error(`missing ${name}`);
  return item;
}

describe("consolidateShoppingList", () => {
  it("sums plan 1 for 7 days, plan 2 for 7 days and plan 3 for 15 days", () => {
    const result = consolidateShoppingList([
      { items: plan1, days: 7 },
      { items: plan2, days: 7 },
      { items: plan3, days: 15 },
    ]);

    expect(result.totalDays).toBe(29);
    expect(result.items.map((item) => item.name)).toEqual([rice.name, chicken.name, banana.name]);
    expect(byName(result.items, rice.name).buyGrams).toBe(150 * 7 + 100 * 7);
    expect(byName(result.items, chicken.name).plannedReadyGrams).toBe(1400);
    expect(byName(result.items, chicken.name).buyGrams).toBeCloseTo(1400 / 0.75, 5);
    expect(byName(result.items, chicken.name).unitLabel).toBe("cru");
    expect(byName(result.items, banana.name).buyGrams).toBe(1800);
    expect(result.estimatedCost).toBeCloseTo(1.75 * 10 + (1400 / 0.75 / 1000) * 30, 5);
    expect(result.missingPriceCount).toBe(1);
  });

  it("counts the same plan entered twice like one entry with the summed days", () => {
    const repeated = consolidateShoppingList([
      { items: plan2, days: 7 },
      { items: plan1, days: 3 },
      { items: plan2, days: 7 },
    ]);
    const single = consolidateShoppingList([
      { items: plan2, days: 14 },
      { items: plan1, days: 3 },
    ]);

    expect(repeated.totalDays).toBe(17);
    expect(byName(repeated.items, chicken.name).buyGrams).toBeCloseTo(byName(single.items, chicken.name).buyGrams, 9);
    expect(byName(repeated.items, rice.name).buyGrams).toBeCloseTo(byName(single.items, rice.name).buyGrams, 9);
    expect(repeated.estimatedCost).toBeCloseTo(single.estimatedCost, 9);
  });

  it("rounds whole eggs to units once, on the consolidated total", () => {
    const result = consolidateShoppingList([
      { items: [{ grams: 100, food: egg }], days: 7 },
      { items: [{ grams: 100, food: egg }], days: 7 },
      { items: [{ grams: 100, food: egg }], days: 15 },
    ]);
    const eggs = byName(result.items, egg.name);

    expect(eggs.isWholeChickenEgg).toBe(true);
    expect(eggs.unitLabel).toBe("unidade");
    expect(eggs.buyGrams).toBe(2900);
    expect(wholeEggUnitCount(eggs.buyGrams)).toBe(55);
    expect(result.estimatedCost).toBeCloseTo(55 * wholeEggUnitPrice(20), 9);
  });

  it("buys lean pork leg raw across every entry", () => {
    const result = consolidateShoppingList([
      { items: [{ grams: 200, food: porkLeg }], days: 7 },
      { items: [{ grams: 200, food: porkLeg }], days: 7 },
      { items: [{ grams: 200, food: porkLeg }], days: 15 },
    ]);
    const pork = byName(result.items, porkLeg.name);

    expect(pork.isLeanCookedPorkLeg).toBe(true);
    expect(pork.plannedReadyGrams).toBe(5800);
    expect(pork.buyGrams).toBeCloseTo(5800 / 0.6875, 5);
  });

  it("keeps the active plan result when there is a single entry", () => {
    const result = consolidateShoppingList([{ items: plan2, days: 15 }]);

    expect(result.totalDays).toBe(15);
    expect(byName(result.items, rice.name).buyGrams).toBe(1500);
    expect(byName(result.items, chicken.name).buyGrams).toBeCloseTo(4000, 5);
    expect(result.estimatedCost).toBeCloseTo(15 + 120, 5);
  });

  it("returns an empty list for an empty menu", () => {
    expect(consolidateShoppingList([])).toEqual({ items: [], totalDays: 0, estimatedCost: 0, missingPriceCount: 0 });
  });
});

describe("shoppingItemCost", () => {
  it("costs nothing without a price", () => {
    expect(shoppingItemCost({ buyGrams: 1000, pricePerKg: null, isWholeChickenEgg: false })).toBe(0);
  });
});

describe("menu days", () => {
  it("adds the days and warns only above 31", () => {
    expect(menuDaysSummary([{ days: 7 }, { days: 7 }, { days: 15 }])).toEqual({ totalDays: 29, exceedsMonth: false });
    expect(menuDaysSummary([{ days: 15 }, { days: 16 }])).toEqual({ totalDays: 31, exceedsMonth: false });
    expect(menuDaysSummary([{ days: 15 }, { days: 15 }, { days: 2 }])).toEqual({ totalDays: 32, exceedsMonth: true });
    expect(menuDaysSummary([])).toEqual({ totalDays: 0, exceedsMonth: false });
  });

  it("accepts whole days from 1 to 90", () => {
    expect(parseMenuEntryDays("7")).toBe(7);
    expect(parseMenuEntryDays(" 15 ")).toBe(15);
    expect(parseMenuEntryDays(1)).toBe(1);
    expect(parseMenuEntryDays("90")).toBe(90);
    for (const invalid of ["0", "91", "7.5", "-3", "", "abc", null, undefined]) {
      expect(parseMenuEntryDays(invalid)).toBeNull();
    }
  });
});

describe("averageDailyMenuNutrition", () => {
  const food = (name: string, kcal: number, protein: number, carbs: number, fat: number) => ({
    name, kcalPer100g: kcal, proteinPer100g: protein, carbsPer100g: carbs, fatPer100g: fat,
  });

  it("weights each plan by its days (7 + 7 + 15)", () => {
    const result = averageDailyMenuNutrition([
      { items: [{ grams: 200, food: food("A", 100, 10, 10, 2) }], days: 7 },
      { items: [{ grams: 200, food: food("B", 200, 20, 20, 4) }], days: 7 },
      { items: [{ grams: 100, food: food("C", 300, 30, 30, 6) }], days: 15 },
    ]);

    expect(result.totalDays).toBe(29);
    expect(result.kcal).toBeCloseTo((200 * 7 + 400 * 7 + 300 * 15) / 29, 9);
    expect(result.protein).toBeCloseTo((20 * 7 + 40 * 7 + 30 * 15) / 29, 9);
    expect(result.carbs).toBeCloseTo((20 * 7 + 40 * 7 + 30 * 15) / 29, 9);
    expect(result.fat).toBeCloseTo((4 * 7 + 8 * 7 + 6 * 15) / 29, 9);
  });

  it("equals the single plan totals when the menu has one entry", () => {
    const result = averageDailyMenuNutrition([
      { items: [{ grams: 150, food: food("A", 130, 2.5, 28, 0.3) }, { grams: 200, food: food("B", 160, 32, 0, 2.5) }], days: 9 },
    ]);

    expect(result.kcal).toBeCloseTo(195 + 320, 9);
    expect(result.protein).toBeCloseTo(3.8 + 64, 1);
  });

  it("returns zeros for an empty menu", () => {
    expect(averageDailyMenuNutrition([])).toEqual({ totalDays: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});
