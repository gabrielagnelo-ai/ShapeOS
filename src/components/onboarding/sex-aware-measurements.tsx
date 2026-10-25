"use client";

import { useState } from "react";
import { CIRCUMFERENCE_FIELDS } from "@/lib/body-measurements";

export function SexAwareMeasurements({ className }: { className: string }) {
  const [sex, setSex] = useState("");

  return (
    <>
      <label className="block">
        <span className="text-sm capitalize text-text-muted">sexo</span>
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
        <span className="text-sm capitalize text-text-muted">pescoço (cm)</span>
        <input inputMode="decimal" name="neckCm" className={className} placeholder="cm. Ex: 43" required />
      </label>

      <label className="block">
        <span className="text-sm capitalize text-text-muted">cintura (cm)</span>
        <input inputMode="decimal" name="waistCm" className={className} placeholder="cm na linha do umbigo. Ex: 108" required />
      </label>

      {sex ? (
        <label className="block">
          <span className="text-sm capitalize text-text-muted">quadril (cm)</span>
          <input
            inputMode="decimal"
            name="hipCm"
            className={className}
            placeholder={sex === "female" ? "cm. Obrigatório para mulheres" : "cm. Opcional"}
            required={sex === "female"}
          />
          <p className="mt-2 text-xs leading-5 text-text-muted">
            {sex === "female" ? "Usado no método da Marinha para mulheres." : "Opcional para homens. Usado no modelo corporal."}
          </p>
        </label>
      ) : null}

      <details className="col-span-full rounded-[14px] bg-surface-tertiary p-4">
        <summary className="cursor-pointer text-sm font-semibold text-text-secondary">Medidas do modelo corporal (opcional)</summary>
        <p className="mt-2 text-xs leading-5 text-text-muted">
          Com elas, o ShapeOS mostra onde você ganhou massa magra ou perdeu gordura. Você pode preencher depois no check-in.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {CIRCUMFERENCE_FIELDS.map((field) => (
            <label key={field.key} className="block">
              <span className="text-sm text-text-muted">{field.label[sex === "female" ? "female" : "male"]} (cm)</span>
              <input inputMode="decimal" name={field.key} className={className} placeholder={`cm. ${field.placeholder}`} />
              <p className="mt-2 text-xs leading-5 text-text-muted">{field.help}</p>
            </label>
          ))}
        </div>
      </details>
    </>
  );
}
