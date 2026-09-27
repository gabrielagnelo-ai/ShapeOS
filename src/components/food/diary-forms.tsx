"use client";

import { useActionState, useState } from "react";
import { addFoodLogAction, deleteFoodLogItemAction, updateFoodLogItemAction } from "@/app/diario/actions";
import { FoodSearchField, type FoodOption } from "./food-search-field";
import { mealNames } from "@/lib/meals";
import { SubmitButton } from "@/components/ui/submit-button";

const fieldClass = "mt-1.5 h-12 w-full rounded-2xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none focus:border-lime-300/60";

export function DiaryFoodForm({ foods, date }: { foods: FoodOption[]; date: string }) {
  const [state, action] = useActionState(addFoodLogAction, {});
  const [grams, setGrams] = useState("");
  const [meal, setMeal] = useState("Almoço");
  // React resets action forms after completion; keep the DOM aligned with our controlled fields.
  return <form action={action} onReset={(event) => event.preventDefault()} className="mt-5 grid gap-4">
    <input type="hidden" name="date" value={date} />
    <div><p className="mb-2 text-sm text-zinc-300">Alimento</p><FoodSearchField foods={foods} /></div>
    <label className="text-sm text-zinc-300">Quantidade em gramas<input name="grams" inputMode="decimal" className={fieldClass} placeholder="Ex.: 150" value={grams} onChange={(e) => setGrams(e.target.value)} required /></label>
    <label className="text-sm text-zinc-300">Refeição<select name="mealName" className={fieldClass} value={meal} onChange={(e) => setMeal(e.target.value)}>{mealNames.map((name) => <option key={name}>{name}</option>)}</select></label>
    <Feedback state={state} />
    <SubmitButton pendingLabel="Registrando…">Adicionar ao dia selecionado</SubmitButton>
  </form>;
}

export function DiaryItemEditor({ item, date, maxDate }: { item: { id: string; foodId: string; grams: number; mealName: string; foodName: string }; date: string; maxDate: string }) {
  const [state, action] = useActionState(updateFoodLogItemAction, {});
  const [deleteState, deleteAction] = useActionState(deleteFoodLogItemAction, {});
  const [grams, setGrams] = useState(String(item.grams));
  const [meal, setMeal] = useState(item.mealName);
  const [entryDate, setEntryDate] = useState(date);
  return <details className="min-w-0 rounded-2xl bg-white/[0.04] p-4">
    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 marker:content-none">
      <span className="min-w-0"><span className="block font-medium">{item.foodName}</span><span className="text-sm text-zinc-400">{item.mealName} · {item.grams.toLocaleString("pt-BR")} g</span></span><span className="rounded-full border border-white/10 px-3 py-2 text-sm text-lime-200">Editar</span>
    </summary>
    <form action={action} onReset={(event) => event.preventDefault()} className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
      <input type="hidden" name="itemId" value={item.id} /><input type="hidden" name="foodId" value={item.foodId} />
      <label className="text-sm text-zinc-300">Gramas<input required name="grams" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} className={fieldClass} /></label>
      <label className="text-sm text-zinc-300">Refeição<select name="mealName" value={meal} onChange={(e) => setMeal(e.target.value)} className={fieldClass}>{mealNames.map((name) => <option key={name}>{name}</option>)}</select></label>
      <label className="min-w-0 text-sm text-zinc-300">Data<input type="date" name="date" required min="1900-01-01" max={maxDate} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={fieldClass} /></label>
      <div className="sm:col-span-3"><Feedback state={state} /></div><SubmitButton>Salvar alteração</SubmitButton>
    </form>
    <details className="mt-4 text-sm"><summary className="w-fit cursor-pointer py-2 text-zinc-400">Remover registro</summary>
      <form action={deleteAction} className="mt-3 grid gap-3">
        <input type="hidden" name="itemId" value={item.id} />
        <label className="flex items-start gap-2 text-zinc-300"><input type="checkbox" name="confirmDelete" required className="mt-1 accent-lime-300" />Confirmo remover este registro do diário. Essa ação não pode ser desfeita.</label>
        <Feedback state={deleteState} /><SubmitButton pendingLabel="Removendo…" className="w-fit rounded-full bg-red-400/10 px-4 py-3 text-red-200">Confirmar remoção</SubmitButton>
      </form>
    </details>
  </details>;
}

function Feedback({ state }: { state: { error?: string; success?: string } }) {
  return state.error ? <p role="alert" className="text-sm text-amber-200">{state.error}</p> : state.success ? <p role="status" className="text-sm text-lime-200">{state.success}</p> : null;
}
