import Image from "next/image";
import { Activity, Apple, BarChart3, Calculator, ChefHat, Home, Settings, Sparkles, Utensils } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Hoje", icon: Home },
  { href: "/calculadoras", label: "Calculadoras", icon: Calculator },
  { href: "/dieta", label: "Dieta", icon: Utensils },
  { href: "/diario", label: "Diário", icon: Apple },
  { href: "/acompanhamento", label: "Semana", icon: BarChart3 },
  { href: "/alimentos", label: "Alimentos", icon: Activity },
  { href: "/receitas", label: "Receitas", icon: ChefHat },
  { href: "/coach", label: "Coach", icon: Sparkles },
  { href: "/configuracoes", label: "Metas", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const mobileLinks = links.filter((link) => ["/dashboard", "/dieta", "/diario", "/coach", "/configuracoes"].includes(link.href));

  return (
    <div className="min-h-screen text-zinc-100">
      <div className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-black/50 shadow-[0_18px_80px_rgba(0,0,0,.35)] backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-[1520px] items-center justify-between px-4 md:px-6">
          <a href="/dashboard" className="group flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-[18px] border border-lime-300/20 bg-lime-300/10 shadow-[0_0_30px_rgba(184,255,0,.12)] transition group-hover:border-lime-300/45 group-hover:bg-lime-300/15">
              <Image src="/shapeos-icon.png" alt="ShapeOS" width={30} height={30} className="rounded-xl" />
            </span>
            <span className="text-lg font-semibold tracking-tight">ShapeOS</span>
          </a>
          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] p-1 shadow-inner shadow-white/5 lg:flex">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/10 hover:text-white"
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
      <main className="mx-auto max-w-[1520px] px-4 pb-28 pt-28 md:px-6 lg:pb-16">
        <div className="animate-fade-scale">{children}</div>
      </main>
      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-[28px] border border-white/10 bg-black/75 p-2 shadow-2xl shadow-black/60 backdrop-blur-2xl lg:hidden">
        {mobileLinks.map((link) => (
          <a key={link.href} href={link.href} className="flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium text-zinc-400 transition hover:bg-white/10 hover:text-white">
            <link.icon size={18} />
            {link.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
