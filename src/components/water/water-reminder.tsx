"use client";

import { useEffect, useState } from "react";

export function WaterReminder({ targetMl }: { targetMl: number }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setEnabled(window.localStorage.getItem("shapeos-water-reminder") === "1");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const interval = window.setInterval(() => {
      if (Notification.permission === "granted") {
        new Notification("ShapeOS", {
          body: `Hora de beber água. Sua meta de hoje é ${(targetMl / 1000).toFixed(1).replace(".", ",")} L.`,
          icon: "/icon.png",
        });
      }
    }, 60 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [enabled, targetMl]);

  async function toggleReminder() {
    if (enabled) {
      localStorage.removeItem("shapeos-water-reminder");
      setEnabled(false);
      return;
    }

    if (!("Notification" in window)) return;
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission === "granted") {
      localStorage.setItem("shapeos-water-reminder", "1");
      setEnabled(true);
      new Notification("ShapeOS", {
        body: "Lembretes de água ativados a cada 1 hora.",
        icon: "/icon.png",
      });
    }
  }

  return (
    <button
      type="button"
      onClick={toggleReminder}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${enabled ? "bg-sky-300 text-black" : "bg-white/10 text-zinc-200 hover:bg-white/15"}`}
    >
      {enabled ? "Lembrete ativo" : "Lembrar 1h"}
    </button>
  );
}
