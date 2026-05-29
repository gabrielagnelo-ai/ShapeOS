"use client";

import { Printer } from "lucide-react";

export function PrintReportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-black transition hover:bg-lime-200 print:hidden"
    >
      <Printer size={16} />
      Exportar PDF
    </button>
  );
}
