import Image from "next/image";
import Link from "next/link";
import { Activity, ArrowRight, Brain, ShieldCheck, Sparkles, Utensils, type LucideIcon } from "lucide-react";
import { CoachBubble } from "@/components/coach/coach-bubble";
import { GlassCard } from "@/components/ui/glass-card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { demoMetrics } from "@/lib/demo-data";

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <section className="relative mx-auto grid min-h-screen max-w-7xl content-center px-5 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(184,255,0,.12),transparent_28%),radial-gradient(circle_at_80%_30%,rgba(10,132,255,.12),transparent_25%)]" />
        <div className="relative z-10 grid gap-10 lg:grid-cols-[1fr_.9fr] lg:items-center">
          <div className="max-w-3xl">
            <Image src="/shapeos-logo.png" alt="ShapeOS" width={1105} height={285} priority className="mb-10 h-auto w-full max-w-xl" />
            <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-7xl">ShapeOS</h1>
            <p className="mt-5 max-w-2xl text-xl leading-8 text-zinc-300">
              Sistema fitness premium para calcular metas, montar dietas brasileiras e receber sinais inteligentes sem ruído de chatbot.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/cadastro" className="inline-flex items-center gap-2 rounded-full bg-lime-300 px-6 py-3 font-medium text-black transition hover:bg-lime-200">
                Criar conta <ArrowRight size={18} />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 font-medium text-white transition hover:bg-white/10">
                Entrar
              </Link>
            </div>
            <p className="mt-6 max-w-xl text-sm leading-6 text-zinc-500">
              O ShapeOS nao substitui medico ou nutricionista. Em diabetes, doenca renal, gestacao, transtornos alimentares, doenca cardiaca ou uso de medicamentos, procure um profissional.
            </p>
          </div>

          <div className="grid gap-4">
            <GlassCard className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Hoje</p>
                  <p className="mt-2 text-4xl font-semibold">{demoMetrics.targets.calories - 680} kcal</p>
                  <p className="mt-1 text-sm text-lime-300">restantes</p>
                </div>
                <ProgressRing value={68} label="aderencia" />
              </div>
            </GlassCard>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["BMR", demoMetrics.bmr],
                ["TDEE", demoMetrics.tdee],
                ["IMC", demoMetrics.bmi],
              ].map(([label, value]) => (
                <GlassCard key={label} className="p-5">
                  <p className="text-sm text-zinc-500">{label}</p>
                  <p className="mt-3 text-2xl font-semibold">{value}</p>
                </GlassCard>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                [Brain, "Coach IA", "Insights contextuais, discretos e acionaveis."],
                [Utensils, "Dieta", "Macros por refeicao, compras e receitas."],
                [Activity, "Evolucao", "Check-ins, aderencia e ajuste automatico."],
                [ShieldCheck, "Etica", "Sem promessas, diagnosticos ou dieta clinica."],
              ] as Array<[LucideIcon, string, string]>).map(([Icon, title, text]) => (
                <GlassCard key={String(title)} className="p-5">
                  <Icon className="mb-4 text-lime-300" size={22} />
                  <h2 className="font-semibold">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
                </GlassCard>
              ))}
            </div>
          </div>
        </div>
      </section>
      <CoachBubble message="Seu peso estabilizou por 14 dias. Talvez seja hora de revisar calorias." />
      <div className="fixed left-5 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 backdrop-blur-xl">
        <Sparkles size={16} className="text-lime-300" /> Inteligencia para sua melhor versao
      </div>
    </main>
  );
}
