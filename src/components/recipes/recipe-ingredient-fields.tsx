"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { FoodSearchField } from "@/components/food/food-search-field";

type FoodOption = {
  id: string;
  name: string;
  category: string;
};

type InitialIngredient = {
  foodId: string;
  foodName: string;
  category: string;
  grams: number;
};

type IngredientRow = InitialIngredient & { key: number };

const fieldClass = "h-12 w-full rounded-[14px] bg-fill px-4 outline-none";

export function RecipeIngredientFields({ foods, initialIngredients = [] }: { foods: FoodOption[]; initialIngredients?: InitialIngredient[] }) {
  const [rows, setRows] = useState<IngredientRow[]>(() =>
    initialIngredients.length
      ? initialIngredients.map((ingredient, index) => ({ ...ingredient, key: index }))
      : [{ key: 0, foodId: "", foodName: "", category: "", grams: 0 }],
  );
  const nextId = useRef(Math.max(1, initialIngredients.length));

  function addIngredient() {
    const id = nextId.current;
    nextId.current += 1;
    setRows((current) => [...current, { key: id, foodId: "", foodName: "", category: "", grams: 0 }]);
  }

  function removeIngredient(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-secondary">
            {rows.length} {rows.length === 1 ? "ingrediente" : "ingredientes"}
          </p>
          <p className="mt-1 text-xs text-text-muted">Adicione todas as quantidades usadas na receita inteira.</p>
        </div>
        <button
          type="button"
          onClick={addIngredient}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-fill text-text-primary hover:bg-fill-strong px-4 text-sm font-semibold"
        >
          <Plus size={16} />
          Adicionar ingrediente
        </button>
      </div>

      <div className="grid gap-2">
        {rows.map((row, index) => (
          <div key={row.key} className="grid min-w-0 gap-2 rounded-[14px] bg-surface-tertiary p-3 md:grid-cols-[minmax(0,1fr)_140px_44px] md:items-start">
            <FoodSearchField
              foods={foods}
              className={fieldClass}
              placeholder={index === 0 ? "Ingrediente principal, ex: patinho" : `Ingrediente ${index + 1}`}
              defaultFood={row.foodId ? { id: row.foodId, name: row.foodName, category: row.category } : undefined}
            />
            <input
              name="grams"
              inputMode="decimal"
              className={fieldClass}
              placeholder="gramas"
              defaultValue={row.grams || undefined}
              aria-label={`Gramas do ingrediente ${index + 1}`}
              required
            />
            <button
              type="button"
              onClick={() => removeIngredient(row.key)}
              disabled={rows.length === 1}
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-transparent bg-fill text-text-muted transition hover:text-danger disabled:cursor-not-allowed disabled:opacity-30 md:h-12 md:w-11"
              aria-label={`Remover ingrediente ${index + 1}`}
              title="Remover ingrediente"
            >
              <Trash2 size={17} />
              <span className="ml-2 md:hidden">Remover ingrediente</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
