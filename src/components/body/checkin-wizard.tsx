"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCheck, Ruler } from "lucide-react";
import { CIRCUMFERENCE_FIELDS } from "@/lib/body-measurements";
import { SubmitButton } from "@/components/ui/submit-button";
import styles from "./checkin-wizard.module.css";
import buttons from "@/components/ui/buttons.module.css";

const steps = ["Medidas", "Sua semana", "Revisão"];
type Defaults = Partial<Record<"waistCm" | "neckCm" | "hipCm" | "chestCm" | "armCm" | "thighCm" | "calfCm", number | null>>;
const value = (n?: number | null) => n == null ? "" : String(n).replace(".", ",");

export function CheckinWizard({ sex, defaults, action }: { sex: "male" | "female"; defaults: Defaults; action: (form: FormData) => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [review, setReview] = useState<Record<string, string>>({});
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  function go(next: number) {
    setDirection(next > step ? 1 : -1); setStep(next); setError("");
    requestAnimationFrame(() => { title.current?.focus({ preventScroll: true }); title.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); });
  }
  function validStep(index: number) {
    const fields = form.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-step="${index}"] input, [data-step="${index}"] select`);
    const invalid = Array.from(fields ?? []).find((input) => !input.checkValidity());
    if (invalid) {
      go(index);
      requestAnimationFrame(() => { invalid.closest("details")?.setAttribute("open", ""); invalid.reportValidity(); });
      return false;
    }
    return true;
  }
  function next() {
    if (!validStep(step)) return;
    const data = new FormData(form.current!);
    setReview(Object.fromEntries([...data.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>);
    go(step + 1);
  }
  function submit(event: FormEvent) {
    if (step < 2) { event.preventDefault(); next(); return; }
    if (![0, 1].every(validStep)) event.preventDefault();
  }
  if (complete) return <section className={styles.complete} role="status">
    <CheckCheck size={32} /><h2>Check-in registrado</h2><p>Suas medidas e o histórico da semana foram atualizados.</p>
    <a href="#evolucao" className={buttons.primary}>Ver minha evolução <ArrowRight size={17} /></a>
  </section>;
  return <section className={styles.wizard} id="novo-checkin">
    <aside className={styles.guide}>
      <span className={styles.guideIcon}><Ruler size={24} /></span>
      <h2>Seu check-in<br />da semana.</h2>
      <p>Comece pelas medidas. Depois, conte como você se sentiu.</p>
      <ol aria-label="Etapas do check-in">{steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined}><span>{index < step ? <Check size={15} /> : index + 1}</span><div>{label}<small>{["Peso e circunferências", "Rotina e bem-estar", "Conferir e salvar"][index]}</small></div></li>)}</ol>
      <p className={styles.privacy}>Fotos e medidas adicionais são opcionais.</p>
    </aside>
    <form ref={form} className={styles.form} noValidate onSubmit={submit} action={async (data) => {
      setError("");
      try { await action(data); setComplete(true); router.refresh(); }
      catch { setError("Não foi possível salvar. Seus dados continuam aqui; tente novamente."); }
    }}>
      <header><span>Etapa {step + 1} de 3</span><h2 ref={title} tabIndex={-1}>{["Como estão suas medidas?", "Como foi sua semana?", "Confira antes de salvar"][step]}</h2><p>{["Use a mesma forma de medir a cada check-in.", "Considere a semana inteira ao responder.", "Volte às etapas anteriores se precisar ajustar algum valor."][step]}</p></header>
      <div data-step="0" hidden={step !== 0} data-direction={direction} className={styles.step}>
        <label className={styles.weight}>Peso médio da semana<div><input name="averageWeightKg" inputMode="decimal" pattern="(?=.*[1-9])[0-9]+([.,][0-9]+)?" placeholder="0,0" required /><span>kg</span></div></label>
        <div className={styles.fields}>
          <label>Cintura <span>cm</span><input name="waistCm" inputMode="decimal" pattern="(?=.*[1-9])[0-9]+([.,][0-9]+)?" defaultValue={value(defaults.waistCm)} required /></label>
          <label>Pescoço <span>cm</span><input name="neckCm" inputMode="decimal" pattern="(?=.*[1-9])[0-9]+([.,][0-9]+)?" defaultValue={value(defaults.neckCm)} required /></label>
          <label>Quadril {sex === "male" && <small>opcional</small>}<input name="hipCm" inputMode="decimal" pattern="(?=.*[1-9])[0-9]+([.,][0-9]+)?" defaultValue={value(defaults.hipCm)} required={sex === "female"} placeholder="cm" /></label>
        </div>
        <details className={styles.additional}><summary>Medir outras regiões <span>Opcional</span></summary><div className={styles.fields}>{CIRCUMFERENCE_FIELDS.map((field) => <label key={field.key}>{field.label[sex]} <span>cm</span><input name={field.key} inputMode="decimal" pattern="(?=.*[1-9])[0-9]+([.,][0-9]+)?" defaultValue={value(defaults[field.key])} placeholder={field.placeholder} /><small>{field.help}</small></label>)}</div></details>
      </div>
      <div data-step="1" hidden={step !== 1} data-direction={direction} className={styles.step}>
        <label className={styles.adherence}>Quanto você seguiu a dieta?<div><input type="number" name="adherencePct" min="0" max="100" step="any" placeholder="0 a 100" required /><span>%</span></div></label>
        <Score name="hunger" label="Fome" low="Pouca fome" high="Muita fome" />
        <Score name="energy" label="Energia" low="Baixa" high="Alta" />
        <Score name="sleep" label="Qualidade do sono" low="Ruim" high="Ótima" />
        <label className={styles.switch}><span>Treinei nesta semana</span><input name="trainingDone" type="checkbox" role="switch" /></label>
      </div>
      <div data-step="2" hidden={step !== 2} data-direction={direction} className={styles.step}>
        <dl className={styles.review}>{[["Peso", review.averageWeightKg, "kg"], ["Cintura", review.waistCm, "cm"], ["Pescoço", review.neckCm, "cm"], ["Quadril", review.hipCm, "cm"], ...CIRCUMFERENCE_FIELDS.map((f) => [f.label[sex], review[f.key], "cm"]), ["Adesão à dieta", review.adherencePct, "%"], ["Fome", review.hunger, "/10"], ["Energia", review.energy, "/10"], ["Sono", review.sleep, "/10"]].filter(([, n]) => n).map(([label, n, unit]) => <div key={label}><dt>{label}</dt><dd>{n} <span>{unit}</span></dd></div>)}<div><dt>Treino na semana</dt><dd>{review.trainingDone === "on" ? "Sim" : "Não"}</dd></div></dl>
        <details className={styles.additional}><summary>Fotos e observações <span>Opcional</span></summary><label className={styles.upload}>Fotos corporais<input name="bodyPhotos" type="file" accept="image/*" multiple /><small>Até 8 imagens, com no máximo 5 MB cada.</small></label><label>Observações<textarea name="notes" placeholder="Algo que queira lembrar sobre esta semana" /></label></details>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <footer>{step > 0 ? <button type="button" onClick={() => go(step - 1)} className={buttons.secondary}><ArrowLeft size={16} /> Voltar</button> : <span />}{step < 2 ? <button type="button" onClick={next} className={buttons.primary}>Continuar <ArrowRight size={16} /></button> : <SubmitButton className={buttons.primary} pendingLabel="Salvando…"><Check size={17} /> Salvar check-in</SubmitButton>}</footer>
    </form>
  </section>;
}

function Score({ name, label, low, high }: { name: string; label: string; low: string; high: string }) {
  return <fieldset className={styles.score}><legend>{label}</legend><div>{Array.from({ length: 10 }, (_, i) => <label key={i}><input type="radio" name={name} value={i + 1} required /><span>{i + 1}</span></label>)}</div><p><span>{low}</span><span>{high}</span></p></fieldset>;
}
