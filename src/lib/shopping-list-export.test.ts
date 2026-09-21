import { describe, expect, it } from "vitest";
import { buildShoppingListText } from "./shopping-list-export";

describe("shopping list export", () => {
  it("exports quantities without prices", () => {
    expect(buildShoppingListText("Lista ShapeOS - 7 dias", ["Ovos — 28 unidades", "Arroz — 1,5 kg"]))
      .toBe("Lista ShapeOS - 7 dias\n\n☐ Ovos — 28 unidades\n☐ Arroz — 1,5 kg");
  });
});
