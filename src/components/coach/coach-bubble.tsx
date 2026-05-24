"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

export function CoachBubble({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), 9000);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-sm animate-[floatIn_.5s_ease] rounded-[24px] border border-lime-300/20 bg-[#111]/80 p-4 shadow-2xl shadow-lime-950/30 backdrop-blur-2xl">
      <div className="flex gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-2xl bg-lime-300/15 text-lime-300">
          <Sparkles size={18} />
        </div>
        <p className="text-sm leading-6 text-zinc-200">{message}</p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-zinc-400 transition hover:bg-white/15 hover:text-white"
          aria-label="Fechar insight"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
