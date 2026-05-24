/* eslint-disable @next/next/no-html-link-for-pages */
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
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-black/55 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5">
          <a href="/" className="flex items-center gap-3">
            <Image src="/shapeos-icon.png" alt="ShapeOS" width={40} height={40} className="rounded-2xl" />
            <span className="text-lg font-semibold tracking-tight">ShapeOS</span>
          </a>
          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                <link.icon size={16} />
                {link.label}
              </a>
            ))}
            <a href="/logout" className="rounded-full border border-white/10 px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white">
              Sair
            </a>
          </nav>
        </div>
      </div>
      <main className="mx-auto max-w-7xl px-5 pb-16 pt-28">{children}</main>
    </div>
  );
}
