import { nutrientsForGrams, toFoodNutrients, type StoredFoodNutrients } from "./nutrition";
import { shoppingListConversion, wholeEggUnitCount, wholeEggUnitPrice } from "./shopping-list";

/** Above this many days the menu covers more than a month; the UI shows a discreet warning. */
export const MENU_DAYS_WARNING_THRESHOLD = 31;
export const MENU_ENTRY_MIN_DAYS = 1;
export const MENU_ENTRY_MAX_DAYS = 90;

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

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
 * Egg units are rounded only once, on the consolidated total. Sorted by category, then name.
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

  const items = [...grouped.values()].sort((a, b) => collator.compare(a.category, b.category) || collator.compare(a.name, b.name));
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

/** Most entries one menu can hold; keeps the form honest and the page light. */
export const MAX_MENU_ENTRIES = 12;

export type MenuDirection = "up" | "down";

export function parseMenuDirection(value: unknown): MenuDirection | null {
  return value === "up" || value === "down" ? value : null;
}

/** New order of entry ids after moving one up or down; null when the move is impossible. */
export function reorderMenuEntryIds(ids: string[], id: string, direction: MenuDirection) {
  const index = ids.indexOf(id);
  if (index < 0) return null;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Flattens the menu into plan items whose grams already cover each entry's days, so a
 * one-day budget (Fluxa) or any per-item consumer sees the whole menu.
 */
export function menuItemsForPeriod<Item extends { grams: number }>(entries: { items: Item[]; days: number }[]) {
  return entries.flatMap((entry) => entry.items.map((item) => ({ ...item, grams: item.grams * entry.days })));
}
