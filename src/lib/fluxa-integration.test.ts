import { describe, expect, it } from "vitest";
import { buildFluxaShoppingBudget, signFluxaPayload } from "./fluxa-integration";

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
