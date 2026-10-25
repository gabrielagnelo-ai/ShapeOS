import Link from "next/link";
import type { buildBodyCompositionProjection } from "@/lib/bodyCompositionEngine";
import styles from "./body-goal.module.css";

type Projection = ReturnType<typeof buildBodyCompositionProjection>;
const number = (value: number | null | undefined, unit: string) => value == null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${unit}`;

export function BodyGoal({ projection: p, waist, targetWaist, weight }: { projection: Projection; waist: number | null; targetWaist: number | null; weight: number }) {
  return <section className={styles.goal} aria-labelledby="body-goal-title">
    <header className={styles.header}>
      <div><h3 id="body-goal-title">Sua meta corporal</h3><p>{p.hasGoal ? "Compare suas medidas com o objetivo definido." : "Você ainda não definiu uma meta."}</p></div>
      <Link href="/configuracoes#meta-corporal">{p.hasGoal ? "Editar meta" : "Definir meta"}<span aria-hidden="true">↗</span></Link>
    </header>
    {p.hasGoal ? <>
      <table className={styles.comparison}>
        <thead><tr><th>Medida</th><th>Atual</th><th>Meta</th></tr></thead>
        <tbody>
          {p.targetBodyFatPct != null ? <tr><th>Gordura corporal</th><td>{number(p.bodyFatProgress.currentBodyFatPct, "%")}</td><td>{number(p.targetBodyFatPct, "%")}</td></tr> : null}
          {targetWaist != null ? <tr><th>Cintura</th><td>{number(waist, " cm")}</td><td>{number(targetWaist, " cm")}</td></tr> : null}
          {p.targetWeightKg != null ? <tr><th>Peso estimado na meta</th><td>{number(weight, " kg")}</td><td>{number(p.targetWeightKg, " kg")}</td></tr> : null}
        </tbody>
      </table>
      <details className={styles.estimates}>
        <summary>Como essa projeção foi calculada</summary>
        <dl>
          <div><dt>Massa magra de referência</dt><dd>{number(p.currentLeanMassKg, " kg")}</dd></div>
          <div><dt>Massa de gordura atual</dt><dd>{number(p.currentFatMassKg, " kg")}</dd></div>
          {p.targetFatMassKg != null ? <div><dt>Massa de gordura na meta</dt><dd>{number(p.targetFatMassKg, " kg")}</dd></div> : null}
          {p.fatMassToLoseKg != null ? <div><dt>Gordura a reduzir</dt><dd>{number(p.fatMassToLoseKg, " kg")}</dd></div> : null}
          {p.probableWeightRangeKg ? <div><dt>Faixa de peso estimada</dt><dd>{number(p.probableWeightRangeKg.minKg, "")}–{number(p.probableWeightRangeKg.maxKg, " kg")}</dd></div> : null}
        </dl>
        <p>Estimativa mantendo a massa magra atual. Confiança {p.confidenceLabel === "media" ? "média" : p.confidenceLabel}; novos check-ins ajudam a acompanhar a tendência.</p>
      </details>
    </> : <p className={styles.empty}>Defina a cintura ou o percentual de gordura desejado para acompanhar a distância até seu objetivo.</p>}
  </section>;
}
