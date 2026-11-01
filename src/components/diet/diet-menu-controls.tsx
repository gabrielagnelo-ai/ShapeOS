"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  addDietMenuEntryAction,
  moveDietMenuEntryAction,
  removeDietMenuEntryAction,
  updateDietMenuEntryDaysAction,
  type MenuActionState,
} from "@/app/dieta/menu-actions";
import { MAX_MENU_ENTRIES, MENU_ENTRY_MAX_DAYS, MENU_ENTRY_MIN_DAYS, parseMenuEntryDays } from "@/lib/diet-menu";
import styles from "./diet-menu.module.css";

const STATUS_EVENT = "diet-menu-status";
const FLASH_MS = 3200;
const ADD_PLAN_ID = "menu-add-plan";

/** Where focus goes after a removal re-renders the list (next row, previous row, or the add form). */
let pendingFocusId: string | null = null;

type Flash = { ok: boolean; text: string; key: number } | null;

/**
 * A short status that clears itself; no tinted band, nothing kept in the URL.
 * Browsers delay timers in hidden tabs (up to a minute), so the expiry time is also checked
 * when the page becomes visible again.
 */
function useFlash() {
  const [flash, setFlash] = useState<Flash>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiresAt = useRef(0);
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && expiresAt.current && Date.now() >= expiresAt.current) {
        expiresAt.current = 0;
        setFlash(null);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  function show(state: MenuActionState) {
    if (!state) return;
    expiresAt.current = Date.now() + FLASH_MS;
    setFlash({ ok: state.ok, text: state.message, key: state.at });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { expiresAt.current = 0; setFlash(null); }, FLASH_MS);
  }
  return [flash, show] as const;
}

function FlashText({ flash, className }: { flash: Flash; className?: string }) {
  return <p role="status" aria-live="polite" className={`${styles.flash} ${className ?? ""}`} data-tone={flash?.ok === false ? "error" : "ok"}>
    {flash ? <span key={flash.key}>{flash.text}</span> : null}
  </p>;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function IconSubmit({ id, label, children, disabled }: { id: string; label: string; children: ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  // aria-disabled while pending keeps focus on the button (a disabled button drops it).
  return <button id={id} type="submit" className={styles.iconButton} aria-label={label} title={label} disabled={disabled} aria-disabled={pending || undefined} aria-busy={pending} onClick={(event) => { if (pending) event.preventDefault(); }}>{children}</button>;
}

export type MenuEntryRowData = { id: string; planName: string; days: number; kcalPerDay: number; isActivePlan: boolean };

/** One plan of the menu: days, reorder and remove. Status appears in the row, focus stays put. */
export function MenuEntryRow({ entry, index, count }: { entry: MenuEntryRowData; index: number; count: number }) {
  const row = useRef<HTMLLIElement>(null);
  const lastTop = useRef<number | null>(null);
  const focusAfterMove = useRef<"up" | "down" | null>(null);
  const [flash, show] = useFlash();

  const lastIndex = useRef(index);
  // FLIP: when the row changes place, slide it from where it was instead of jumping.
  // Position is re-read after every commit so it is fresh when the order changes.
  useLayoutEffect(() => {
    const element = row.current;
    if (!element) return;
    const top = element.getBoundingClientRect().top + window.scrollY;
    const previous = lastTop.current;
    const moved = lastIndex.current !== index;
    lastTop.current = top;
    lastIndex.current = index;
    if (!moved || previous == null || previous === top || prefersReducedMotion()) return;
    element.animate([{ transform: `translateY(${previous - top}px)` }, { transform: "translateY(0)" }], { duration: 240, easing: "cubic-bezier(.23, 1, .32, 1)" });
  });

  useEffect(() => {
    const direction = focusAfterMove.current;
    if (!direction) return;
    focusAfterMove.current = null;
    const same = document.getElementById(`menu-move-${entry.id}-${direction}`) as HTMLButtonElement | null;
    const other = document.getElementById(`menu-move-${entry.id}-${direction === "up" ? "down" : "up"}`) as HTMLButtonElement | null;
    (same && !same.disabled ? same : other)?.focus({ preventScroll: false });
  }, [index, entry.id]);

  async function move(formData: FormData) {
    const direction = formData.get("direction") === "up" ? "up" : "down";
    focusAfterMove.current = direction;
    show(await moveDietMenuEntryAction(null, formData));
  }

  async function remove(formData: FormData) {
    const li = row.current;
    const neighbour = (li?.nextElementSibling ?? li?.previousElementSibling) as HTMLElement | null;
    pendingFocusId = neighbour?.dataset.entryId ? `menu-remove-${neighbour.dataset.entryId}` : ADD_PLAN_ID;
    const state = await removeDietMenuEntryAction(null, formData);
    window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: state }));
  }

  return <li ref={row} className={styles.entry} data-entry-id={entry.id}>
    <span className={styles.order} aria-hidden="true">{index + 1}</span>
    <div className={styles.entryMain}>
      <p className={styles.entryName}>{entry.planName}</p>
      <p className={styles.entryMeta}>{Math.round(entry.kcalPerDay).toLocaleString("pt-BR")} kcal por dia{entry.isActivePlan ? " · Ativo" : ""}</p>
      <FlashText flash={flash} />
    </div>
    <div className={styles.entryControls}>
      <DaysField key={entry.days} entry={entry} onResult={show} />
      <div className={styles.entryActions}>
        <form action={move}>
          <input type="hidden" name="entryId" value={entry.id} />
          <input type="hidden" name="direction" value="up" />
          <IconSubmit id={`menu-move-${entry.id}-up`} label={`Mover ${entry.planName} para cima`} disabled={index === 0}><ChevronUp size={18} aria-hidden="true" /></IconSubmit>
        </form>
        <form action={move}>
          <input type="hidden" name="entryId" value={entry.id} />
          <input type="hidden" name="direction" value="down" />
          <IconSubmit id={`menu-move-${entry.id}-down`} label={`Mover ${entry.planName} para baixo`} disabled={index === count - 1}><ChevronDown size={18} aria-hidden="true" /></IconSubmit>
        </form>
        <RemoveControl entry={entry} action={remove} />
      </div>
    </div>
  </li>;
}

/** Days of one entry. "Salvar" appears only after a change; Esc anywhere in the field puts the saved value back. */
function DaysField({ entry, onResult }: { entry: MenuEntryRowData; onResult: (state: MenuActionState) => void }) {
  const [value, setValue] = useState(String(entry.days));
  const [serverError, setServerError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const parsed = parseMenuEntryDays(value);
  const dirty = value !== String(entry.days);
  const invalid = (dirty && parsed == null) || serverError != null;
  const inputId = `menu-days-${entry.id}`;
  const hintId = `${inputId}-hint`;

  async function save(formData: FormData) {
    const state = await updateDietMenuEntryDaysAction(null, formData);
    if (state && !state.ok) { setServerError(state.message); input.current?.focus(); return; }
    onResult(state);
    // The field remounts with the saved value (key={days}); put focus back on it.
    requestAnimationFrame(() => document.getElementById(inputId)?.focus());
  }

  return <form action={save} className={styles.daysForm} onKeyDown={(event) => {
    if (event.key !== "Escape" || !dirty) return;
    event.preventDefault();
    setValue(String(entry.days));
    setServerError(null);
    input.current?.focus();
  }}>
    <input type="hidden" name="entryId" value={entry.id} />
    <label htmlFor={inputId}>Dias</label>
    <input
      ref={input}
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
      aria-invalid={invalid}
      aria-describedby={invalid ? hintId : undefined}
      aria-label={`Dias de ${entry.planName}`}
      onChange={(event) => { setValue(event.target.value); setServerError(null); }}
    />
    {dirty ? <SaveDays disabled={parsed == null} /> : null}
    {invalid ? <p id={hintId} className={styles.fieldError}>{serverError ?? "Use um número inteiro de 1 a 90."}</p> : null}
  </form>;
}

function SaveDays({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={styles.saveDays} disabled={disabled} aria-disabled={pending || undefined} aria-busy={pending} onClick={(event) => { if (pending) event.preventDefault(); }}>{pending ? "Salvando…" : "Salvar"}</button>;
}

/** Two taps to remove: the first arms the button; it disarms after 5 s or when focus leaves. */
function RemoveControl({ entry, action }: { entry: MenuEntryRowData; action: (formData: FormData) => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function arm() {
    setArmed(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setArmed(false), 5000);
  }
  if (!armed) {
    return <button id={`menu-remove-${entry.id}`} type="button" className={styles.iconButton} aria-label={`Remover ${entry.planName} do cardápio`} title="Remover" onClick={arm}><Trash2 size={17} aria-hidden="true" /></button>;
  }
  return <form action={action}>
    <input type="hidden" name="entryId" value={entry.id} />
    <ConfirmRemove planName={entry.planName} id={`menu-remove-${entry.id}`} onBlur={() => setArmed(false)} />
  </form>;
}

function ConfirmRemove({ planName, id, onBlur }: { planName: string; id: string; onBlur: () => void }) {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return <button ref={ref} id={id} type="submit" className={styles.confirmRemove} aria-busy={pending} aria-label={`Confirmar remoção de ${planName}`} onBlur={() => { if (!pending) onBlur(); }} onClick={(event) => { if (pending) event.preventDefault(); }}>{pending ? "Removendo…" : "Remover"}</button>;
}

/**
 * Sits above the list: announces removals (the removed row can't) and moves focus to the
 * neighbouring row once the list has re-rendered. `signature` changes whenever entries do.
 */
export function MenuListStatus({ signature }: { signature: string }) {
  const [flash, show] = useFlash();
  useEffect(() => {
    const listener = (event: Event) => show((event as CustomEvent<MenuActionState>).detail);
    window.addEventListener(STATUS_EVENT, listener);
    return () => window.removeEventListener(STATUS_EVENT, listener);
  });
  useEffect(() => {
    if (!pendingFocusId) return;
    const target = document.getElementById(pendingFocusId);
    pendingFocusId = null;
    target?.focus();
  }, [signature]);
  return <FlashText flash={flash} className={styles.listFlash} />;
}

export function MenuAddForm({ plans, planCount }: { plans: { id: string; name: string }[]; planCount: number }) {
  const [flash, show] = useFlash();
  const full = planCount >= MAX_MENU_ENTRIES;
  async function add(formData: FormData) {
    show(await addDietMenuEntryAction(null, formData));
    requestAnimationFrame(() => document.getElementById("menu-add-submit")?.focus());
  }
  return <form action={add} className={styles.addForm}>
    <p className={styles.addTitle}>{planCount ? "Adicionar outro plano" : "Adicionar o primeiro plano"}</p>
    <div className={styles.addFields}>
      <label className={styles.planField}>
        <span>Plano</span>
        <select id={ADD_PLAN_ID} name="planId" required defaultValue={plans[0]?.id} disabled={full}>
          {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
        </select>
      </label>
      <label className={styles.daysField}>
        <span>Dias</span>
        <input name="days" type="number" inputMode="numeric" enterKeyHint="done" min={MENU_ENTRY_MIN_DAYS} max={MENU_ENTRY_MAX_DAYS} step={1} required defaultValue={7} disabled={full} />
      </label>
      <AddButton disabled={full} />
    </div>
    <FlashText flash={flash} />
    {full ? <p className={styles.addHint}>O cardápio está com {MAX_MENU_ENTRIES} planos, o máximo. Remova um para adicionar outro.</p> : null}
  </form>;
}

function AddButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button id="menu-add-submit" type="submit" className={styles.addButton} disabled={disabled} aria-disabled={pending || undefined} aria-busy={pending} onClick={(event) => { if (pending) event.preventDefault(); }}>
    <Plus size={17} aria-hidden="true" />
    {pending ? "Adicionando…" : "Adicionar"}
  </button>;
}
