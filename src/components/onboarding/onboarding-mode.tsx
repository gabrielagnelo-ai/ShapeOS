"use client";

import { useState, type ReactNode } from "react";

export function OnboardingMode({ children, advanced }: { children: ReactNode; advanced: ReactNode }) {
  const [mode, setMode] = useState("guided");
  return <>
    <fieldset className="mb-6">
      <legend className="mb-3 font-semibold">Como você prefere começar?</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {[{ value: "guided", title: "Guiado", text: "Responda o essencial. Calculamos suas metas iniciais." }, { value: "advanced", title: "Avançado", text: "Ajuste déficit, proteína, gordura e fator de atividade." }].map((option) => <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${mode === option.value ? "border-lime-300/40 bg-lime-300/5" : "border-white/10"}`}><input type="radio" name="mode" value={option.value} checked={mode === option.value} onChange={() => setMode(option.value)} className="mt-1 accent-lime-300" /><span><span className="block font-medium">{option.title}</span><span className="mt-1 block text-sm leading-6 text-zinc-400">{option.text}</span></span></label>)}
      </div>
    </fieldset>
    <div className="grid gap-5">{children}{mode === "advanced" ? advanced : null}</div>
  </>;
}
