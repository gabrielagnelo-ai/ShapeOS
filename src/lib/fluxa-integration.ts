import { createHmac } from "node:crypto";
import { shoppingListConversion, wholeEggUnitCount, wholeEggUnitPrice } from "./shopping-list";

type DietItemInput = {
  grams: number;
  food: {
    id: string;
    name: string;
    category: string;
    pricePerKg: number | null;
  };
};

export type FluxaShoppingItem = {
  foodId: string;
  name: string;
  category: string;
  quantity: number;
  unit: "g" | "kg" | "unit";
  unitPrice: number | null;
  subtotal: number | null;
};

export function buildFluxaShoppingBudget(items: DietItemInput[], days = 30) {
  const grouped = new Map<string, {
    food: DietItemInput["food"];
    buyGrams: number;
    isWholeChickenEgg: boolean;
  }>();

  for (const item of items) {
    const conversion = shoppingListConversion({
      foodId: item.food.id,
      name: item.food.name,
      category: item.food.category,
      readyGrams: item.grams * days,
    });
    const current = grouped.get(item.food.id) ?? {
      food: item.food,
      buyGrams: 0,
      isWholeChickenEgg: conversion.isWholeChickenEgg,
    };
    current.buyGrams += conversion.buyGrams;
    grouped.set(item.food.id, current);
  }

  const budgetItems: FluxaShoppingItem[] = [...grouped.values()].map((item) => {
    if (item.isWholeChickenEgg) {
      const quantity = wholeEggUnitCount(item.buyGrams);
      const unitPrice = item.food.pricePerKg == null ? null : wholeEggUnitPrice(item.food.pricePerKg);
      return {
        foodId: item.food.id,
        name: item.food.name,
        category: item.food.category,
        quantity,
        unit: "unit",
        unitPrice: unitPrice == null ? null : roundMoney(unitPrice),
        subtotal: unitPrice == null ? null : roundMoney(quantity * unitPrice),
      };
    }

    const useKg = item.buyGrams >= 1000;
    const quantity = useKg ? item.buyGrams / 1000 : item.buyGrams;
    const unitPrice = item.food.pricePerKg == null
      ? null
      : useKg
        ? item.food.pricePerKg
        : item.food.pricePerKg / 1000;

    return {
      foodId: item.food.id,
      name: item.food.name,
      category: item.food.category,
      quantity: roundQuantity(quantity),
      unit: useKg ? "kg" : "g",
      unitPrice: unitPrice == null ? null : roundMoney(unitPrice),
      subtotal: item.food.pricePerKg == null ? null : roundMoney((item.buyGrams / 1000) * item.food.pricePerKg),
    };
  });

  const estimatedTotal = roundMoney(budgetItems.reduce((total, item) => total + (item.subtotal ?? 0), 0));
  const missingPriceCount = budgetItems.filter((item) => item.subtotal == null).length;

  return {
    days,
    items: budgetItems,
    summary: {
      estimatedTotal,
      pricedItemCount: budgetItems.length - missingPriceCount,
      missingPriceCount,
    },
  };
}

export function signFluxaPayload(secret: string, timestamp: string, rawBody: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundQuantity(value: number) {
  return Math.round(value * 1000) / 1000;
}
