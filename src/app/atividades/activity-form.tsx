"use client";

import { Activity, Clock3, Info } from "lucide-react";
import { useMemo, useState } from "react";
import type { ActivityEffort, ActivityPreset } from "@/lib/activity";
import { addPhysicalActivityAction } from "./actions";

const inputClass = "h-12 rounded-2xl border border-white/10 bg-black/30 px-4 outline-none transition focus:border-lime-300/50";

export function ActivityForm({
  presets,
  efforts,
  defaultDate,
  strengthWarning,
}: {
  presets: ActivityPreset[];
  efforts: Array<{ key: ActivityEffort; label: string; helper: string; multiplier: number }>;
  defaultDate: string;
  strengthWarning: string | null;
}) {
  const [activityKey, setActivityKey] = useState("weight_training");
  const selected = useMemo(() => presets.find((preset) => preset.key === activityKey) ?? presets[0], [activityKey, presets]);
  const isWalking = selected.category === "walking";

  return (
    <form action={addPhysicalActivityAction} className="mt-6 grid gap-4">
      {strengthWarning ? (
        <div className="rounded-[24px] border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
          {strengthWarning}
        </div>
      ) : null}

      <label className="grid gap-2">
        <span className="text-sm font-medium text-zinc-400">O que voce fez?</span>
        <select name="activityKey" className={inputClass} value={activityKey} onChange={(event) => setActivityKey(event.target.value)}>
          {presets.map((preset) => (
            <option key={preset.key} value={preset.key}>{preset.name}</option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-zinc-400">Quando?</span>
          <input name="date" type="date" defaultValue={defaultDate} className={inputClass} />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-zinc-400">Durou quanto tempo?</span>
          <div className="relative">
            <Clock3 className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input name="durationMinutes" inputMode="numeric" className={`${inputClass} pl-11`} placeholder="Ex: 45 minutos" required />
          </div>
        </label>
      </div>

      {isWalking ? (
        <div className="grid gap-3 rounded-[26px] border border-lime-300/20 bg-lime-300/[0.06] p-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-zinc-300">Distancia em km</span>
            <input name="distanceKm" inputMode="decimal" className={inputClass} placeholder="Ex: 8" required />
          </label>
          <div className="rounded-2xl bg-black/25 p-4 text-sm leading-6 text-zinc-400">
            O ShapeOS calcula a velocidade media e define automaticamente se foi leve, moderada ou rapida.
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <span className="text-sm font-medium text-zinc-400">Como foi o esforco?</span>
          <div className="grid gap-2 md:grid-cols-3">
            {efforts.map((effort) => (
              <label key={effort.key} className="cursor-pointer rounded-[24px] border border-white/10 bg-black/25 p-4 transition hover:border-lime-300/40 has-[:checked]:border-lime-300/60 has-[:checked]:bg-lime-300/10">
                <input type="radio" name="effort" value={effort.key} defaultChecked={effort.key === "moderate"} className="sr-only" />
                <span className="block font-semibold text-zinc-100">{effort.label}</span>
                <span className="mt-1 block text-sm leading-5 text-zinc-500">{effort.helper}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <label className="grid gap-2">
        <span className="text-sm font-medium text-zinc-400">Se escolheu Outra atividade, escreva o nome</span>
        <input name="customName" className={inputClass} placeholder="Ex: jiu-jitsu, beach tennis, obra em casa" />
      </label>

      <input name="note" className={inputClass} placeholder="Observacao opcional. Ex: treino de pernas" />

      <label className="grid gap-2">
        <span className="text-sm font-medium text-zinc-400">Como considerar no gasto do dia?</span>
        <select name="tdeeChoice" className={inputClass} defaultValue="auto">
          <option value="auto">Automatico e conservador</option>
          <option value="ignore">Registrar, mas nao somar no TDEE</option>
          <option value="count_extra">Contar como atividade extra mesmo assim</option>
          <option value="switch_additive">Trocar para modo aditivo</option>
        </select>
        <span className="text-xs leading-5 text-zinc-500">
          Caminhadas entram como extra valida. Musculacao pode ser ignorada no modo coeficiente para evitar dupla contagem.
        </span>
      </label>

      {!isWalking ? (
        <details className="rounded-[24px] border border-white/10 bg-black/20 p-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-zinc-300">
            <Info size={16} />
            Ajuste avancado
          </summary>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            Use apenas se voce ja souber o equivalente metabolico da atividade. Se deixar vazio, o ShapeOS calcula automaticamente pela atividade e intensidade.
          </p>
          <input name="met" inputMode="decimal" className={`${inputClass} mt-3`} placeholder="Valor tecnico opcional" />
        </details>
      ) : null}

      <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lime-300 px-5 font-semibold text-black transition hover:bg-lime-200">
        <Activity size={18} />
        Registrar atividade
      </button>
    </form>
  );
}
