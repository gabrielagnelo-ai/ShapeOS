"use client";

import { Check, Copy, Download, Share2 } from "lucide-react";
import { useState } from "react";
import { buildShoppingListText } from "@/lib/shopping-list-export";

export function ShoppingListExport({ title, items }: { title: string; items: string[] }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const text = buildShoppingListText(title, items);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        return;
      }
      await copy();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      showFeedback("Não foi possível compartilhar");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      showFeedback("Lista copiada");
    } catch {
      showFeedback("Não foi possível copiar");
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "lista-de-compras-shapeos.txt";
    link.click();
    URL.revokeObjectURL(url);
    showFeedback("Arquivo baixado");
  }

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2200);
  }

  if (!items.length) return null;

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={share} className="inline-flex h-10 items-center gap-2 rounded-full bg-lime-300 px-4 text-sm font-semibold text-black transition hover:bg-lime-200">
          <Share2 size={15} /> Compartilhar
        </button>
        <button type="button" onClick={copy} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/15">
          <Copy size={15} /> Copiar
        </button>
        <button type="button" onClick={download} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/15">
          <Download size={15} /> TXT
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-zinc-500">No iPhone ou iPad, use Compartilhar e escolha Lembretes, Notas ou outro app. Preços não são incluídos.</p>
      {feedback ? <p className="mt-2 inline-flex items-center gap-1 text-xs text-lime-200"><Check size={13} /> {feedback}</p> : null}
    </div>
  );
}
