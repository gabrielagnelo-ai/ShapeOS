"use client";

import { useMemo, useState } from "react";

type FoodOption = {
  id: string;
  name: string;
  category: string | null;
};

export function FoodSearchField({ foods }: { foods: FoodOption[] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return foods.slice(0, 12);

    const terms = normalizedQuery.split(" ").filter(Boolean);
    return foods
      .filter((food) => {
        const searchable = normalize(`${food.name} ${food.category ?? ""}`);
        return terms.every((term) => searchable.includes(term));
      })
      .slice(0, 14);
  }, [foods, query]);

  function selectFood(food: FoodOption) {
    setQuery(food.name);
    setSelectedId(food.id);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input type="hidden" name="foodId" value={selectedId} />
      <input
        name="foodQuery"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedId("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 outline-none transition focus:border-lime-300/50"
        placeholder="Digite o alimento. Ex: frango, arroz, banana"
        required
      />
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-80 overflow-y-auto rounded-3xl border border-white/10 bg-[#111] p-2 shadow-2xl shadow-black/70">
          {matches.length ? (
            matches.map((food) => (
              <button
                key={food.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectFood(food)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-white/10 focus:bg-white/10 focus:outline-none"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{food.name}</span>
                <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-zinc-400">{food.category ?? "Base"}</span>
              </button>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm leading-6 text-zinc-400">
              Nenhum alimento encontrado. Você ainda pode enviar o texto para o ShapeOS tentar encontrar o mais próximo.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
