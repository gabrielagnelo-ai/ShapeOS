"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { moveDietMenuEntryAction, removeDietMenuEntryAction, updateDietMenuEntryDaysAction } from "@/app/dieta/menu-actions";
import { MENU_ENTRY_MAX_DAYS, MENU_ENTRY_MIN_DAYS, parseMenuEntryDays } from "@/lib/diet-menu";
import styles from "./diet-menu.module.css";

function IconSubmit({ label, children, disabled, tone }: { label: string; children: ReactNode; disabled?: boolean; tone?: "danger" }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={styles.iconButton} data-tone={tone} aria-label={label} title={label} disabled={disabled || pending} aria-busy={pending}>{children}</button>;
}

/** Days of one entry. "Salvar" appears only after a change; Esc puts the saved value back.
 *  Render with key={days} so a saved value resets the field. */
export function MenuEntryDaysField({ entryId, days, planName }: { entryId: string; days: number; planName: string }) {
  const [value, setValue] = useState(String(days));
  const parsed = parseMenuEntryDays(value);
  const dirty = value !== String(days);
  const inputId = `menu-days-${entryId}`;
  const hintId = `${inputId}-hint`;
  return <form action={updateDietMenuEntryDaysAction} className={styles.daysForm}>
    <input type="hidden" name="entryId" value={entryId} />
    <label htmlFor={inputId}>Dias</label>
    <input
      id={inputId}
      name="days"
      type="number"
      inputMode="numeric"
      enterKeyHint="done"
      min={MENU_ENTRY_MIN_DAYS}
      max={MENU_ENTRY_MAX_DAYS}
      step={1}
      required
      value={value}
      aria-invalid={dirty && parsed == null}
      aria-describedby={dirty && parsed == null ? hintId : undefined}
      aria-label={`Dias de ${planName}`}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Escape") setValue(String(days)); }}
    />
    {dirty ? <SaveDays disabled={parsed == null} /> : null}
    {dirty && parsed == null ? <p id={hintId} className={styles.fieldError}>Use um número inteiro de 1 a 90.</p> : null}
  </form>;
}

function SaveDays({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={styles.saveDays} disabled={disabled || pending} aria-busy={pending}>{pending ? "Salvando…" : "Salvar"}</button>;
}

export function MenuEntryMoveButtons({ entryId, planName, isFirst, isLast }: { entryId: string; planName: string; isFirst: boolean; isLast: boolean }) {
  return <>
    <form action={moveDietMenuEntryAction}>
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="direction" value="up" />
      <IconSubmit label={`Mover ${planName} para cima`} disabled={isFirst}><ChevronUp size={18} aria-hidden="true" /></IconSubmit>
    </form>
    <form action={moveDietMenuEntryAction}>
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="direction" value="down" />
      <IconSubmit label={`Mover ${planName} para baixo`} disabled={isLast}><ChevronDown size={18} aria-hidden="true" /></IconSubmit>
    </form>
  </>;
}

/** Two taps to remove: the first arms the button for a few seconds, the second submits. */
export function MenuEntryRemoveButton({ entryId, planName }: { entryId: string; planName: string }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function arm() {
    setArmed(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setArmed(false), 4000);
  }
  if (!armed) {
    return <button type="button" className={styles.iconButton} aria-label={`Remover ${planName} do cardápio`} title="Remover" onClick={arm}><Trash2 size={17} aria-hidden="true" /></button>;
  }
  return <form action={removeDietMenuEntryAction}>
    <input type="hidden" name="entryId" value={entryId} />
    <ConfirmRemove planName={planName} />
  </form>;
}

function ConfirmRemove({ planName }: { planName: string }) {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return <button ref={ref} type="submit" className={styles.confirmRemove} disabled={pending} aria-busy={pending} aria-label={`Confirmar remoção de ${planName}`}>{pending ? "Removendo…" : "Remover"}</button>;
}
