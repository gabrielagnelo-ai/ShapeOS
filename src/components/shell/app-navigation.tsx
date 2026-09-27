"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef } from "react";
import { Activity, Apple, BarChart3, Calculator, ChefHat, Dumbbell, FileText, FlaskConical, Home, LogOut, MoreHorizontal, Settings, Sparkles, Utensils, X } from "lucide-react";

const primary = [
  { href: "/dashboard", label: "Hoje", icon: Home },
  { href: "/diario", label: "Diário", icon: Apple },
  { href: "/dieta", label: "Dieta", icon: Utensils },
  { href: "/acompanhamento", label: "Progresso", icon: BarChart3 },
];
const secondary = [
  { href: "/treinos", label: "Treinos", icon: Dumbbell },
  { href: "/atividades", label: "Atividades", icon: Activity },
  { href: "/receitas", label: "Receitas", icon: ChefHat },
  { href: "/alimentos", label: "Alimentos", icon: Apple },
  { href: "/suplementos", label: "Suplementos", icon: FlaskConical },
  { href: "/calculadoras", label: "Calculadoras", icon: Calculator },
  { href: "/relatorio-nutricionista", label: "Relatório", icon: FileText },
  { href: "/coach", label: "Coach", icon: Sparkles },
  { href: "/configuracoes", label: "Metas e perfil", icon: Settings },
];

export function AppNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  useEffect(() => { dialog.current?.close(); }, [pathname]);
  const itemClass = mobile
    ? "flex min-w-0 min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:outline-lime-300"
    : "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-lime-300";
  const color = (selected: boolean) => selected ? " bg-lime-300/15 text-lime-200" : " text-zinc-400 hover:bg-white/10 hover:text-white";
  return (
    <>
      <nav aria-label={mobile ? "Navegação mobile" : "Navegação principal"} className={mobile
        ? "fixed inset-x-2 bottom-[max(.5rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 gap-1 rounded-[24px] border border-white/10 bg-[#0b0c0b]/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl xl:hidden"
        : "hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] p-1 xl:flex"}>
        {primary.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={itemClass + color(active(href))}>
            <Icon size={mobile ? 19 : 17} aria-hidden="true" /><span>{label}</span>
          </Link>
        ))}
        <button type="button" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()} className={itemClass + color(secondary.some(({ href }) => active(href)))}>
          <MoreHorizontal size={mobile ? 21 : 17} aria-hidden="true" /><span>Mais</span>
        </button>
      </nav>
      <dialog ref={dialog} aria-labelledby={titleId} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-3xl border border-white/15 bg-[#121512] p-5 text-zinc-100 shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-xl font-semibold">Explore o ShapeOS</h2>
          <button autoFocus type="button" aria-label="Fechar menu" onClick={() => dialog.current?.close()} className="grid size-11 place-items-center rounded-full bg-white/5 hover:bg-white/10"><X size={20} /></button>
        </div>
        <nav aria-label="Todas as ferramentas" className="grid grid-cols-2 gap-2">
          {secondary.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => dialog.current?.close()} aria-current={active(href) ? "page" : undefined} className={`flex min-h-16 items-center gap-3 rounded-2xl px-3 py-3 text-sm ${color(active(href))}`}>
              <Icon size={19} className="shrink-0" /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <a href="/logout" className="mt-5 flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 px-4 text-sm text-zinc-300 hover:bg-white/5"><LogOut size={18} />Sair da conta</a>
      </dialog>
    </>
  );
}
