export const LEAN_COOKED_PORK_LEG_FOOD_ID = "cmpucesnm000204lkz0tx3tv4";

const LEAN_COOKED_PORK_LEG_YIELD = 0.6875;

type ShoppingListConversionInput = {
  foodId: string;
  name: string;
  category: string;
  readyGrams: number;
};

export function shoppingListConversion({
  foodId,
  name,
  category,
  readyGrams,
}: ShoppingListConversionInput) {
  const isLeanCookedPorkLeg = foodId === LEAN_COOKED_PORK_LEG_FOOD_ID;
  const yieldFactor = isLeanCookedPorkLeg
    ? LEAN_COOKED_PORK_LEG_YIELD
    : cookingYieldFactor(name, category);

  return {
    buyGrams: readyGrams / yieldFactor,
    isLeanCookedPorkLeg,
    unitLabel: yieldFactor < 1 ? "cru" : "total",
  } as const;
}

function cookingYieldFactor(name: string, category: string) {
  const normalized = `${name} ${category}`.toLowerCase();
  if (normalized.includes("peixe") || normalized.includes("tilapia") || normalized.includes("sardinha")) return 0.8;
  if (normalized.includes("carne") || normalized.includes("frango") || normalized.includes("patinho") || normalized.includes("grelhado") || normalized.includes("assado")) return 0.75;
  return 1;
}
