import Image from "next/image";
import { Activity, Apple, BarChart3, Calculator, ChefHat, Dumbbell, FileText, FlaskConical, Home, LogOut, Settings, Sparkles, Utensils } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Hoje", icon: Home },
  { href: "/calculadoras", label: "Calculadoras", icon: Calculator },
  { href: "/dieta", label: "Dieta", icon: Utensils },
  { href: "/diario", label: "Diário", icon: Apple },
  { href: "/acompanhamento", label: "Semana", icon: BarChart3 },
  { href: "/atividades", label: "Atividades", icon: Activity },
  { href: "/treinos", label: "Treinos", icon: Dumbbell },
  { href: "/alimentos", label: "Alimentos", icon: Activity },
  { href: "/receitas", label: "Receitas", icon: ChefHat },
  { href: "/suplementos", label: "Suplementos", icon: FlaskConical },
  { href: "/relatorio-nutricionista", label: "Relatório", icon: FileText },
  { href: "/coach", label: "Coach", icon: Sparkles },
  { href: "/configuracoes", label: "Metas", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh text-zinc-100">
      <div className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-black/50 shadow-[0_18px_80px_rgba(0,0,0,.35)] backdrop-blur-2xl">
        <div className="mx-auto flex h-16 w-full max-w-[1840px] items-center justify-between gap-3 px-3 sm:h-20 sm:px-4 md:px-6 2xl:px-8">
          <a href="/dashboard" className="group flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-[18px] border border-lime-300/20 bg-lime-300/10 shadow-[0_0_30px_rgba(184,255,0,.12)] transition group-hover:border-lime-300/45 group-hover:bg-lime-300/15 sm:size-11">
              <Image src="/shapeos-icon.png" alt="ShapeOS" width={30} height={30} className="rounded-xl" />
            </span>
            <span className="truncate text-lg font-semibold tracking-tight">ShapeOS</span>
          </a>
          <nav className="hidden max-w-[calc(100vw-230px)] items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.035] p-1 shadow-inner shadow-white/5 xl:flex">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                <link.icon size={16} />
                {link.label}
              </a>
            ))}
            <a href="/logout" className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:border-red-300/30 hover:bg-red-400/10 hover:text-red-100">
              Sair
            </a>
          </nav>
        </div>
      </div>
      <main className="mx-auto w-full max-w-[1840px] px-3 pb-28 pt-24 sm:px-4 sm:pt-28 md:px-6 xl:pb-16 2xl:px-8">
        <div className="animate-fade-scale">{children}</div>
      </main>
      <nav className="fixed inset-x-2 bottom-2 z-40 grid auto-cols-[76px] grid-flow-col gap-1 overflow-x-auto rounded-[28px] border border-white/10 bg-black/80 p-2 shadow-2xl shadow-black/60 backdrop-blur-2xl sm:inset-x-4 sm:auto-cols-[96px] xl:hidden">
        {links.map((link) => (
          <a key={link.href} href={link.href} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-[11px] font-medium text-zinc-400 transition hover:bg-white/10 hover:text-white">
            <link.icon size={18} />
            <span className="max-w-full truncate">{link.label}</span>
          </a>
        ))}
        <a href="/logout" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-[11px] font-medium text-zinc-400 transition hover:bg-red-400/10 hover:text-red-100">
          <LogOut size={18} />
          <span>Sair</span>
        </a>
      </nav>
    </div>
  );
}
