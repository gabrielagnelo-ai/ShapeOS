export const LEAN_COOKED_PORK_LEG_FOOD_ID = "cmpucesnm000204lkz0tx3tv4";
export const WHOLE_CHICKEN_EGG_GRAMS = 53;

const WHOLE_CHICKEN_EGG_FOOD_IDS = new Set([
  "ovo-de-galinha-inteiro",
  "taco-488",
  "taco-489",
  "taco-490",
]);

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
  const isWholeEgg = isWholeChickenEgg({ foodId, name });
  const yieldFactor = isLeanCookedPorkLeg
    ? LEAN_COOKED_PORK_LEG_YIELD
    : cookingYieldFactor(name, category);

  return {
    buyGrams: readyGrams / yieldFactor,
    isLeanCookedPorkLeg,
    isWholeChickenEgg: isWholeEgg,
    gramsPerUnit: isWholeEgg ? WHOLE_CHICKEN_EGG_GRAMS : null,
    unitLabel: isWholeEgg ? "unidade" : yieldFactor < 1 ? "cru" : "total",
  } as const;
}

export function isWholeChickenEgg({ foodId, name }: { foodId: string; name: string }) {
  if (WHOLE_CHICKEN_EGG_FOOD_IDS.has(foodId)) return true;

  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();

  return normalized.includes("ovo")
    && normalized.includes("galinha")
    && normalized.includes("inteiro")
    && !normalized.includes("codorna")
    && !normalized.includes("clara")
    && !normalized.includes("gema");
}

export function wholeEggUnitCount(grams: number) {
  return Math.ceil(grams / WHOLE_CHICKEN_EGG_GRAMS);
}

export function wholeEggUnitPrice(pricePerKg: number) {
  return pricePerKg * (WHOLE_CHICKEN_EGG_GRAMS / 1000);
}

export function wholeEggPricePerKg(pricePerUnit: number) {
  return pricePerUnit * (1000 / WHOLE_CHICKEN_EGG_GRAMS);
}

function cookingYieldFactor(name: string, category: string) {
  const normalized = `${name} ${category}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (isCannedOrPreserved(normalized)) return 1;
  if (normalized.includes("peixe") || normalized.includes("tilapia") || normalized.includes("sardinha")) return 0.8;
  if (normalized.includes("carne") || normalized.includes("frango") || normalized.includes("patinho") || normalized.includes("grelhado") || normalized.includes("assado")) return 0.75;
  return 1;
}

/**
 * Canned or preserved food is bought ready to eat: there is no raw version to convert.
 * Tuna is canned in Brazilian markets unless the name says it is fresh.
 */
function isCannedOrPreserved(normalized: string) {
  if (/\b(conserva|enlatad[oa]s?|em lata)\b/.test(normalized)) return true;
  if (/\b(atum|sardinha)\b.*\b(ralad[oa]|ao natural|em oleo|em molho)\b/.test(normalized)) return true;
  return /\batum\b/.test(normalized) && !/\b(fresco|cru|posta|file|grelhad[oa]|assad[oa]|selad[oa])\b/.test(normalized);
}
