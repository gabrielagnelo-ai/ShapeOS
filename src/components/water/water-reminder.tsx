"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Bell, Droplets } from "lucide-react";
import { EMPTY_REMINDER, WATER_REMINDER_KEY, isWaterReminderDue, parseWaterReminder, scheduleWaterReminder, type WaterReminderState } from "@/lib/water-reminder";

const changeEvent = "shapeos-water-reminder-change";
let memorySnapshot = "";
let memoryOnly = false;
function snapshot() {
  if (memoryOnly) return memorySnapshot;
  try { return window.localStorage.getItem(WATER_REMINDER_KEY) ?? ""; }
  catch { return memorySnapshot; }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(changeEvent, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(changeEvent, listener); };
}
function save(state: WaterReminderState) {
  memorySnapshot = JSON.stringify(state);
  try { window.localStorage.setItem(WATER_REMINDER_KEY, memorySnapshot); }
  catch { memoryOnly = true; }
  window.dispatchEvent(new Event(changeEvent));
}
function useReminder() {
  const value = useSyncExternalStore(subscribe, snapshot, () => "");
  return useMemo(() => parseWaterReminder(value), [value]);
}

// Montado no shell de todas as abas; o horário sobrevive a navegação e recarga.
export function WaterReminderRunner() {
  const state = useReminder();
  useEffect(() => {
    const check = () => {
      const current = parseWaterReminder(snapshot());
      if (!isWaterReminderDue(current, Date.now())) return;
      save({ ...current, due: true });
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("Hora de beber água", { body: "Faça uma pausa para se hidratar.", icon: "/shapeos-mark.png", tag: "shapeos-water" });
        } catch { /* O aviso no app permanece disponível em navegadores sem suporte. */ }
      }
    };
    const timer = window.setInterval(check, 15000);
    const initial = window.setTimeout(() => {
      try {
        if (!snapshot() && window.localStorage.getItem("shapeos-water-reminder") === "1") {
          save(scheduleWaterReminder(Date.now()));
          window.localStorage.removeItem("shapeos-water-reminder");
        }
      } catch { /* O agendamento atual continua em memória. */ }
      check();
    }, 0);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer); window.clearTimeout(initial);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  if (!state.enabled || !state.due) return null;
  return (
    <aside role="status" aria-live="polite" className="glass-menu fixed inset-x-4 bottom-28 z-50 mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-[22px] p-4 text-text-primary md:bottom-6">
      <span className="icon-tile [--tile:#32ade6]"><Droplets aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><p className="font-semibold">Hora de beber água</p><p className="text-xs text-text-muted">Faça uma pausa para se hidratar.</p></div>
      <button type="button" onClick={() => save(scheduleWaterReminder(Date.now()))} className="min-h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-light">Lembrar em 1h</button>
      <button type="button" onClick={() => save(EMPTY_REMINDER)} className="min-h-11 rounded-full px-3 text-sm font-semibold text-text-secondary hover:bg-fill">Desativar</button>
    </aside>
  );
}

export function WaterReminder() {
  const state = useReminder();
  const [notificationStatus, setNotificationStatus] = useState("");
  async function enableNotifications() {
    if (!("Notification" in window)) { setNotificationStatus("Este navegador não oferece notificações. O aviso aparece dentro do ShapeOS."); return; }
    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission === "granted" ? "Notificações permitidas." : "Notificações bloqueadas. O aviso continua ativo dentro do ShapeOS.");
    } catch { setNotificationStatus("Não foi possível ativar notificações. O aviso continua ativo no app."); }
  }
  return (
    <div className="basis-full pt-1">
      <button type="button" aria-pressed={state.enabled} onClick={() => save(state.enabled ? EMPTY_REMINDER : scheduleWaterReminder(Date.now()))} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${state.enabled ? "bg-primary/15 text-primary hover:bg-primary/20" : "bg-fill text-text-primary hover:bg-fill-strong"}`}>
        <Bell size={15} aria-hidden="true" />{state.enabled ? "Desativar lembrete" : "Lembrar em 1h"}
      </button>
      {state.enabled ? <div className="mt-2 space-y-1 text-xs leading-5 text-text-muted" role="status">
        <p>{state.due ? "Hora de beber água." : `Próximo aviso às ${new Date(state.nextAt!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`} Mantenha o ShapeOS aberto. Se o navegador suspender a aba, o aviso aparece ao voltar.</p>
        <button type="button" onClick={enableNotifications} className="min-h-11 font-semibold text-primary">Permitir notificações</button>
        {notificationStatus ? <p>{notificationStatus}</p> : null}
      </div> : null}
    </div>
  );
}
