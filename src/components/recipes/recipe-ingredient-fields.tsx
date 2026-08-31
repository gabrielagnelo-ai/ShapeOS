"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { FoodSearchField } from "@/components/food/food-search-field";

type FoodOption = {
  id: string;
  name: string;
  category: string;
};

const fieldClass = "h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 outline-none transition focus:border-lime-300/50";

export function RecipeIngredientFields({ foods }: { foods: FoodOption[] }) {
  const [rows, setRows] = useState([0]);
  const nextId = useRef(1);

  function addIngredient() {
    const id = nextId.current;
    nextId.current += 1;
    setRows((current) => [...current, id]);
  }

  function removeIngredient(id: number) {
    setRows((current) => current.filter((rowId) => rowId !== id));
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-200">
            {rows.length} {rows.length === 1 ? "ingrediente" : "ingredientes"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Adicione todas as quantidades usadas na receita inteira.</p>
        </div>
        <button
          type="button"
          onClick={addIngredient}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-zinc-100 transition hover:border-lime-300/30 hover:bg-lime-300/10"
        >
          <Plus size={16} />
          Adicionar ingrediente
        </button>
      </div>

      <div className="grid gap-2">
        {rows.map((id, index) => (
          <div key={id} className="grid min-w-0 gap-2 rounded-3xl border border-white/[0.07] bg-black/20 p-3 md:grid-cols-[minmax(0,1fr)_140px_44px] md:items-start">
            <FoodSearchField
              foods={foods}
              className={fieldClass}
              placeholder={index === 0 ? "Ingrediente principal, ex: patinho" : `Ingrediente ${index + 1}`}
            />
            <input
              name="grams"
              inputMode="decimal"
              className={fieldClass}
              placeholder="gramas"
              aria-label={`Gramas do ingrediente ${index + 1}`}
              required
            />
            <button
              type="button"
              onClick={() => removeIngredient(id)}
              disabled={rows.length === 1}
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/10 text-zinc-400 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-30 md:h-12 md:w-11"
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
