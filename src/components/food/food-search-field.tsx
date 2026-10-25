"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type FoodOption = {
  id: string;
  name: string;
  category: string | null;
  kcalPer100g?: number;
};

export function FoodSearchField({
  foods,
  className = "h-12 w-full rounded-[14px] bg-fill px-4 outline-none",
  placeholder = "Digite o alimento. Ex: frango, arroz, banana",
  defaultFood,
}: {
  foods: FoodOption[];
  className?: string;
  placeholder?: string;
  defaultFood?: FoodOption;
}) {
  const [query, setQuery] = useState(defaultFood?.name ?? "");
  const [selectedId, setSelectedId] = useState(defaultFood?.id ?? "");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    input.current?.setCustomValidity(selectedId ? "" : "Escolha um alimento na lista de resultados.");
  }, [selectedId, query]);

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
    setHighlighted(-1);
    input.current?.setCustomValidity("");
  }

  return (
    <div className="relative min-w-0" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <input type="hidden" name="foodId" value={selectedId} />
      <input
        ref={input}
        role="combobox"
        aria-label={placeholder}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-results`}
        aria-activedescendant={open && highlighted >= 0 && matches[highlighted] ? `${id}-${highlighted}` : undefined}
        aria-describedby={`${id}-hint`}
        name="foodQuery"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedId("");
          setOpen(true);
          setHighlighted(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") { setOpen(false); return; }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setHighlighted((current) => Math.max(0, Math.min(matches.length - 1, current + (event.key === "ArrowDown" ? 1 : -1))));
          }
          if (event.key === "Enter" && open && highlighted >= 0 && matches[highlighted]) {
            event.preventDefault();
            selectFood(matches[highlighted]);
          }
        }}
        autoComplete="off"
        className={className}
        placeholder={placeholder}
        required
      />
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-text-muted">{selectedId ? "Alimento selecionado." : "Digite e escolha uma opção da lista."}</p>
      {open ? (
        <div id={`${id}-results`} role="listbox" aria-label="Alimentos encontrados" className="glass-menu absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-72 overflow-y-auto rounded-[22px] p-1.5">
          {matches.length ? (
            matches.map((food, index) => (
              <button
                key={food.id}
                type="button"
                role="option"
                id={`${id}-${index}`}
                tabIndex={-1}
                aria-selected={food.id === selectedId}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectFood(food)}
                className={`flex w-full items-center justify-between gap-3 rounded-[14px] px-3 py-2.5 text-left hover:bg-fill-strong focus:bg-fill-strong focus:outline-none ${highlighted === index ? "bg-fill-strong" : ""}`}
              >
                <span className="min-w-0 flex-1 text-sm font-medium text-text-primary">{food.name}<span className="mt-0.5 block text-xs font-normal text-text-muted">{food.category ?? "Base"}{food.kcalPer100g !== undefined ? ` · ${Math.round(food.kcalPer100g)} kcal/100 g` : ""}</span></span>
              </button>
            ))
          ) : (
            <div className="p-3 text-sm leading-6 text-text-muted">
              Nenhum alimento encontrado. Tente outro termo ou cadastre-o na área Alimentos.
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
