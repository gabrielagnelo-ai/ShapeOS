import { describe, expect, it } from "vitest";
import { buildFluxaMenuShoppingBudget, buildFluxaShoppingBudget, signFluxaPayload } from "./fluxa-integration";

describe("Fluxa integration", () => {
  it("aggregates a 30-day shopping budget without nutrition data", () => {
    const result = buildFluxaShoppingBudget([
      { grams: 100, food: { id: "rice", name: "Arroz", category: "Cereais", pricePerKg: 8 } },
      { grams: 106, food: { id: "ovo-de-galinha-inteiro", name: "Ovo de galinha inteiro", category: "Ovos", pricePerKg: 10 } },
    ]);

    expect(result.days).toBe(30);
    expect(result.items).toEqual([
      expect.objectContaining({ foodId: "rice", quantity: 3, unit: "kg", unitPrice: 8, subtotal: 24 }),
      expect.objectContaining({ foodId: "ovo-de-galinha-inteiro", quantity: 60, unit: "unit", unitPrice: 0.53, subtotal: 31.8 }),
    ]);
    expect(result.summary).toEqual({ estimatedTotal: 55.8, pricedItemCount: 2, missingPriceCount: 0 });
  });

  it("marks foods without prices instead of treating them as free", () => {
    const result = buildFluxaShoppingBudget([
      { grams: 200, food: { id: "beans", name: "Feijão", category: "Leguminosas", pricePerKg: null } },
    ]);

    expect(result.items[0].subtotal).toBeNull();
    expect(result.summary).toEqual({ estimatedTotal: 0, pricedItemCount: 0, missingPriceCount: 1 });
  });

  it("signs the exact timestamp and request body", () => {
    expect(signFluxaPayload("secret", "1700000000", '{"ok":true}')).toBe(
      "c1afc7c2df3db0690d7d75954610ed1a1d959ce96355ccb8c0a8bc09fd0cfc27",
    );
  });
});

describe("buildFluxaMenuShoppingBudget", () => {
  const egg = { id: "taco-488", name: "Ovo de galinha inteiro cozido", category: "Ovos e derivados", pricePerKg: 20 };
  const rice = { id: "rice", name: "Arroz branco cozido", category: "Cereais", pricePerKg: 10 };

  it("sums every entry, reports the menu days and rounds eggs once", () => {
    const budget = buildFluxaMenuShoppingBudget([
      { items: [{ grams: 100, food: egg }, { grams: 150, food: rice }], days: 7 },
      { items: [{ grams: 100, food: egg }], days: 7 },
      { items: [{ grams: 100, food: egg }, { grams: 100, food: rice }], days: 15 },
    ]);

    expect(budget.days).toBe(29);
    const eggs = budget.items.find((item) => item.foodId === egg.id);
    expect(eggs?.unit).toBe("unit");
    expect(eggs?.quantity).toBe(55);
    const riceItem = budget.items.find((item) => item.foodId === rice.id);
    expect(riceItem?.unit).toBe("kg");
    expect(riceItem?.quantity).toBeCloseTo(2.55, 3);
  });

  it("matches the active plan budget for a single 30-day entry", () => {
    const items = [{ grams: 100, food: egg }, { grams: 150, food: rice }];
    const menu = buildFluxaMenuShoppingBudget([{ items, days: 30 }]);
    const plan = buildFluxaShoppingBudget(items, 30);
    expect(menu).toEqual(plan);
  });
});
