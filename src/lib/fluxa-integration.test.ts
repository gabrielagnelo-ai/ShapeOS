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
  const chicken = { id: "chicken", name: "Frango grelhado", category: "Carnes", pricePerKg: 30 };
  const banana = { id: "banana", name: "Banana prata", category: "Frutas", pricePerKg: null };
  const sumSubtotals = (items: { subtotal: number | null }[]) => Math.round(items.reduce((total, item) => total + (item.subtotal ?? 0), 0) * 100) / 100;

  it.each([
    { n: 29, entries: [7, 7, 15] },
    { n: 34, entries: [7, 20, 7] },
  ])("normalizes a $n-day menu to 30 days with a consistent total", ({ n, entries }) => {
    const plans = [
      [{ grams: 100, food: egg }, { grams: 150, food: rice }],
      [{ grams: 200, food: chicken }, { grams: 120, food: banana }],
      [{ grams: 100, food: egg }, { grams: 100, food: rice }],
    ];
    const budget = buildFluxaMenuShoppingBudget(entries.map((days, index) => ({ items: plans[index], days })));

    expect(budget.days).toBe(30);
    expect(Math.abs(sumSubtotals(budget.items) - budget.summary.estimatedTotal)).toBeLessThanOrEqual(0.05);
    expect(budget.summary.missingPriceCount).toBe(1);

    const scale = 30 / n;
    const eggGrams = 100 * (entries[0] + entries[2]) * scale;
    expect(budget.items.find((item) => item.foodId === egg.id)?.quantity).toBe(Math.ceil(eggGrams / 53));
    const riceGrams = (150 * entries[0] + 100 * entries[2]) * scale;
    expect(budget.items.find((item) => item.foodId === rice.id)?.subtotal).toBeCloseTo(Math.round(riceGrams / 1000 * 10 * 100) / 100, 2);
  });

  it("matches the active plan budget for a single 30-day entry", () => {
    const items = [{ grams: 100, food: egg }, { grams: 150, food: rice }];
    expect(buildFluxaMenuShoppingBudget([{ items, days: 30 }])).toEqual(buildFluxaShoppingBudget(items, 30));
  });

  it.each([
    { label: "one 29-day entry", entries: [{ items: [{ grams: 265, food: egg }], days: 29 }] },
    { label: "7 + 7 + 15", entries: [7, 7, 15].map((days) => ({ items: [{ grams: 265, food: egg }], days })) },
    { label: "the same plan repeated", entries: [14, 15].map((days) => ({ items: [{ grams: 265, food: egg }], days })) },
    { label: "the egg split across meals", entries: [{ items: [{ grams: 100, food: egg }, { grams: 165, food: egg }], days: 29 }] },
    { label: "split across meals and entries", entries: [7, 7, 15].map((days) => ({ items: [{ grams: 53, food: egg }, { grams: 212, food: egg }], days })) },
  ])("gives 150 eggs and R$ 159,00 for 265 g a day over 29 days: $label", ({ entries }) => {
    const budget = buildFluxaMenuShoppingBudget(entries);
    expect(budget.days).toBe(30);
    expect(budget.items).toHaveLength(1);
    expect(budget.items[0]).toMatchObject({ quantity: 150, unit: "unit", subtotal: 159 });
    expect(budget.summary.estimatedTotal).toBe(159);
  });

  it("keeps whole eggs exact at the 265 g x 29 days boundary", () => {
    const budget = buildFluxaMenuShoppingBudget([{ items: [{ grams: 265, food: egg }], days: 29 }]);
    const eggs = budget.items.find((item) => item.foodId === egg.id);
    expect(budget.days).toBe(30);
    expect(eggs?.quantity).toBe(150);
    expect(eggs?.subtotal).toBe(159);
    expect(budget.summary.estimatedTotal).toBe(159);
    expect(budget).toEqual(buildFluxaShoppingBudget([{ grams: 265, food: egg }], 30));
  });

  it("scales a 15-day plan up to 30 days", () => {
    const items = [{ grams: 150, food: rice }];
    expect(buildFluxaMenuShoppingBudget([{ items, days: 15 }])).toEqual(buildFluxaShoppingBudget(items, 30));
  });
});
