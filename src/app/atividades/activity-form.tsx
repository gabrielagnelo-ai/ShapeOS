"use client";

import { Activity, Clock3, Info } from "lucide-react";
import { useMemo, useState } from "react";
import type { ActivityEffort, ActivityPreset } from "@/lib/activity";
import { addPhysicalActivityAction } from "./actions";

const inputClass = "h-12 rounded-[14px] px-4 outline-none";

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
        <div className="rounded-[14px] bg-warning/10 p-4 text-sm leading-6 text-warning">
          {strengthWarning}
        </div>
      ) : null}

      <label className="grid gap-2">
        <span className="text-sm font-medium text-text-muted">O que você fez?</span>
        <select name="activityKey" className={inputClass} value={activityKey} onChange={(event) => setActivityKey(event.target.value)}>
          {presets.map((preset) => (
            <option key={preset.key} value={preset.key}>{preset.name}</option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-text-muted">Quando?</span>
          <input name="date" type="date" defaultValue={defaultDate} className={inputClass} />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-text-muted">Durou quanto tempo?</span>
          <div className="relative">
            <Clock3 className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input name="durationMinutes" inputMode="numeric" className={`${inputClass} w-full pl-11`} placeholder="Ex: 45 minutos" required />
          </div>
        </label>
      </div>

      {isWalking ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text-secondary">Distância em km</span>
            <input name="distanceKm" inputMode="decimal" className={inputClass} placeholder="Ex: 8" required />
          </label>
          <div className="self-end pb-1 text-sm leading-6 text-text-muted">
            O ShapeOS calcula a velocidade média e define automaticamente se foi leve, moderada ou rápida.
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <span className="text-sm font-medium text-text-muted">Como foi o esforço?</span>
          <div className="grid gap-1 rounded-[14px] bg-fill p-1 md:grid-cols-3">
            {efforts.map((effort) => (
              <label key={effort.key} className="cursor-pointer rounded-[11px] p-3 has-[:checked]:bg-[var(--glass-selected)] has-[:checked]:shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--primary)]">
                <input type="radio" name="effort" value={effort.key} defaultChecked={effort.key === "moderate"} className="sr-only" />
                <span className="block font-semibold">{effort.label}</span>
                <span className="mt-0.5 block text-sm leading-5 text-text-muted">{effort.helper}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <label className="grid gap-2">
        <span className="text-sm font-medium text-text-muted">Se escolheu Outra atividade, escreva o nome</span>
        <input name="customName" className={inputClass} placeholder="Ex: jiu-jitsu, beach tennis, obra em casa" />
      </label>

      <input name="note" className={inputClass} placeholder="Observação opcional. Ex: treino de pernas" />

      <label className="grid gap-2">
        <span className="text-sm font-medium text-text-muted">Como considerar no gasto do dia?</span>
        <select name="tdeeChoice" className={inputClass} defaultValue="auto">
          <option value="auto">Automático e conservador</option>
          <option value="ignore">Registrar, mas não somar no TDEE</option>
          <option value="count_extra">Contar como atividade extra mesmo assim</option>
          <option value="switch_additive">Trocar para modo aditivo</option>
        </select>
        <span className="text-xs leading-5 text-text-muted">
          Caminhadas entram como extra válida. Musculação pode ser ignorada no modo coeficiente para evitar dupla contagem.
        </span>
      </label>

      {!isWalking ? (
        <details className="border-t border-hairline pt-3">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-text-secondary">
            <Info size={16} />
            Ajuste avançado
          </summary>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            Use apenas se você já souber o equivalente metabólico da atividade. Se deixar vazio, o ShapeOS calcula automaticamente pela atividade e intensidade.
          </p>
          <input name="met" inputMode="decimal" className={`${inputClass} mt-3`} placeholder="Valor técnico opcional" />
        </details>
      ) : null}

      <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-light">
        <Activity size={18} />
        Registrar atividade
      </button>
    </form>
  );
}
