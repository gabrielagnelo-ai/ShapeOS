import { nutrientsForGrams, toFoodNutrients, type StoredFoodNutrients } from "./nutrition";
import { shoppingListConversion, wholeEggUnitCount, wholeEggUnitPrice } from "./shopping-list";

/** Above this many days the menu covers more than a month; the UI shows a discreet warning. */
export const MENU_DAYS_WARNING_THRESHOLD = 31;
export const MENU_ENTRY_MIN_DAYS = 1;
export const MENU_ENTRY_MAX_DAYS = 90;

export type ShoppingFood = {
  id: string;
  name: string;
  category: string;
  pricePerKg: number | null;
};

export type ShoppingEntry = {
  items: { grams: number; food: ShoppingFood }[];
  days: number;
};

export type ConsolidatedShoppingItem = {
  name: string;
  foodId: string;
  category: string;
  plannedReadyGrams: number;
  buyGrams: number;
  unitLabel: string;
  pricePerKg: number | null;
  isLeanCookedPorkLeg: boolean;
  isWholeChickenEgg: boolean;
};

/**
 * Sums every plan item times the days of its entry into one shopping list, grouped by food
 * name (the same grouping the Compras tab always used). The active plan is a single entry.
 * Egg units are rounded only once, on the consolidated total.
 */
export function consolidateShoppingList(entries: ShoppingEntry[]) {
  const grouped = new Map<string, ConsolidatedShoppingItem>();

  for (const entry of entries) {
    for (const item of entry.items) {
      const readyGrams = item.grams * entry.days;
      const conversion = shoppingListConversion({
        foodId: item.food.id,
        name: item.food.name,
        category: item.food.category,
        readyGrams,
      });
      const current = grouped.get(item.food.name) ?? {
        name: item.food.name,
        foodId: item.food.id,
        category: item.food.category,
        plannedReadyGrams: 0,
        buyGrams: 0,
        unitLabel: conversion.unitLabel,
        pricePerKg: item.food.pricePerKg,
        isLeanCookedPorkLeg: conversion.isLeanCookedPorkLeg,
        isWholeChickenEgg: conversion.isWholeChickenEgg,
      };
      current.plannedReadyGrams += readyGrams;
      current.buyGrams += conversion.buyGrams;
      grouped.set(item.food.name, current);
    }
  }

  const items = [...grouped.values()];
  return {
    items,
    totalDays: totalMenuDays(entries),
    estimatedCost: items.reduce((total, item) => total + shoppingItemCost(item), 0),
    missingPriceCount: items.filter((item) => item.pricePerKg == null).length,
  };
}

export function shoppingItemCost(item: { buyGrams: number; pricePerKg: number | null; isWholeChickenEgg: boolean }) {
  if (!item.pricePerKg) return 0;
  if (item.isWholeChickenEgg) return wholeEggUnitCount(item.buyGrams) * wholeEggUnitPrice(item.pricePerKg);
  return (item.buyGrams / 1000) * item.pricePerKg;
}

export function totalMenuDays(entries: { days: number }[]) {
  return entries.reduce((total, entry) => total + entry.days, 0);
}

export function menuDaysSummary(entries: { days: number }[]) {
  const totalDays = totalMenuDays(entries);
  return { totalDays, exceedsMonth: totalDays > MENU_DAYS_WARNING_THRESHOLD };
}

/** Days of one menu entry: whole number from 1 to 90, or null when invalid. */
export function parseMenuEntryDays(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : value;
  if (raw === "" || raw == null) return null;
  const days = Number(raw);
  if (!Number.isInteger(days) || days < MENU_ENTRY_MIN_DAYS || days > MENU_ENTRY_MAX_DAYS) return null;
  return days;
}

export type NutritionEntry = {
  items: { grams: number; food: StoredFoodNutrients }[];
  days: number;
};

/** Average planned kcal and macros per day across the menu, weighted by each entry's days. */
export function averageDailyMenuNutrition(entries: NutritionEntry[]) {
  const totalDays = totalMenuDays(entries);
  const sum = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  for (const entry of entries) {
    for (const item of entry.items) {
      const nutrients = nutrientsForGrams(toFoodNutrients(item.food), item.grams);
      sum.kcal += nutrients.kcal * entry.days;
      sum.protein += nutrients.proteinG * entry.days;
      sum.carbs += nutrients.carbsG * entry.days;
      sum.fat += nutrients.fatG * entry.days;
    }
  }

  if (totalDays <= 0) return { totalDays: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 };
  return {
    totalDays,
    kcal: sum.kcal / totalDays,
    protein: sum.protein / totalDays,
    carbs: sum.carbs / totalDays,
    fat: sum.fat / totalDays,
  };
}
