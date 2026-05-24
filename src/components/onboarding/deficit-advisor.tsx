"use client";

import { useMemo, useState } from "react";
import { assessDeficitRisk } from "@/lib/nutrition";

export function DeficitAdvisor({ name, className, defaultValue = 400 }: { name: string; className: string; defaultValue?: number }) {
  const [deficit, setDeficit] = useState(defaultValue);
  const [weight, setWeight] = useState(0);

  const assessment = useMemo(() => assessDeficitRisk({ weightKg: weight, deficitKcal: deficit }), [deficit, weight]);

  return (
    <div>
      <select
        name={name}
        className={className}
        defaultValue={String(defaultValue)}
        onFocus={() => setWeight(readWeight())}
        onChange={(event) => {
          setDeficit(Number(event.target.value));
          setWeight(readWeight());
        }}
      >
        <option value="100">100 kcal - bem conservador</option>
        <option value="200">200 kcal - leve</option>
        <option value="300">300 kcal - moderado baixo</option>
        <option value="400">400 kcal - padrão guiado</option>
        <option value="500">500 kcal - moderado</option>
        <option value="750">750 kcal - redução alta</option>
        <option value="1000">1000 kcal - redução muito alta</option>
      </select>
      <p className={messageClass(assessment.level)}>{assessment.message}</p>
    </div>
  );
}

function readWeight() {
  const input = document.querySelector<HTMLInputElement>('input[name="weight"]');
  return Number(input?.value.replace(",", ".") ?? 0);
}

function messageClass(level: "info" | "good" | "warning" | "danger") {
  const base = "mt-2 rounded-2xl border px-3 py-2 text-xs leading-5";
  if (level === "good") return `${base} border-lime-300/20 bg-lime-300/10 text-lime-200`;
  if (level === "warning") return `${base} border-yellow-300/20 bg-yellow-300/10 text-yellow-100`;
  if (level === "danger") return `${base} border-red-400/25 bg-red-500/10 text-red-100`;
  return `${base} border-white/10 bg-white/[0.04] text-zinc-400`;
}
