"use client";

import { useState } from "react";

export function SexAwareMeasurements({ className }: { className: string }) {
  const [sex, setSex] = useState("");

  return (
    <>
      <label className="block">
        <span className="text-sm capitalize text-zinc-400">sexo</span>
        <select
          name="sex"
          className={className}
          defaultValue=""
          required
          onChange={(event) => setSex(event.target.value)}
        >
          <option value="" disabled>Selecione</option>
          <option value="male">Masculino</option>
          <option value="female">Feminino</option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm capitalize text-zinc-400">pescoco</span>
        <input name="neckCm" className={className} placeholder="cm. Ex: 43" required />
      </label>

      <label className="block">
        <span className="text-sm capitalize text-zinc-400">cintura</span>
        <input name="waistCm" className={className} placeholder="cm na linha do umbigo. Ex: 108" required />
      </label>

      {sex === "female" ? (
        <label className="block">
          <span className="text-sm capitalize text-zinc-400">quadril</span>
          <input
            name="hipCm"
            className={className}
            placeholder="cm. Obrigatório para mulheres"
            required
          />
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Usado no método da Marinha para mulheres.
          </p>
        </label>
      ) : null}
    </>
  );
}
