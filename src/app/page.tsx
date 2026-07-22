import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Brain, Check, LineChart, LockKeyhole, Scale, ShieldCheck, Sparkles, Utensils, type LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { ProgressRing } from "@/components/ui/progress-ring";

const features: Array<[LucideIcon, string, string]> = [
  [Brain, "Coach IA discreto", "Ele observa seus registros e avisa quando existe algo importante para ajustar."],
  [Utensils, "Plano alimentar claro", "Monte sua dieta com IA ou registre o plano do nutricionista, sem planilhas confusas."],
  [LineChart, "Evolução visível", "Peso, cintura e composição estimada viram uma leitura simples de progresso."],
  [ShieldCheck, "Seguro por design", "Sem promessas milagrosas. O app orienta, mas respeita limites de saúde."],
];

const steps = [
  ["01", "Informe seu perfil", "Altura, peso, medidas, objetivo, atividade e preferências alimentares."],
  ["02", "Receba uma meta clara", "O ShapeOS traduz seus dados em calorias, proteínas, gorduras e refeições."],
  ["03", "Acompanhe sem adivinhar", "Registre sua rotina e veja quando manter o plano ou fazer um ajuste."],
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <div className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-black/55 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/shapeos-icon.png" alt="ShapeOS" width={42} height={42} className="rounded-2xl" priority />
            <span className="text-lg font-semibold">ShapeOS</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-full px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white sm:inline-flex">
              Entrar
            </Link>
            <Link href="/cadastro" className="inline-flex items-center gap-2 rounded-full bg-lime-300 px-4 py-2 text-sm font-semibold text-black transition hover:bg-lime-200">
              Criar conta
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>

      <section className="relative mx-auto grid min-h-screen max-w-7xl content-center px-5 pb-16 pt-28">
        <Image
          src="/shapeos-logo.png"
          alt=""
          width={1105}
          height={285}
          priority
          className="pointer-events-none absolute left-1/2 top-28 w-[980px] max-w-none -translate-x-1/2 opacity-[0.07] blur-[1px]"
        />
        <div className="relative z-10 grid gap-10 lg:grid-cols-[1fr_.92fr] lg:items-center">
          <div className="animate-rise">
            <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/25 bg-lime-300/10 px-4 py-2 text-sm text-lime-200">
              <Sparkles size={16} />
              Inteligência para sua melhor versão
            </div>
            <h1 className="mt-8 max-w-4xl text-6xl font-semibold tracking-tight text-white md:text-7xl">
              Alcance seu shape com uma dieta guiada por inteligência.
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-9 text-zinc-300">
              O ShapeOS transforma seus dados em metas simples, refeições práticas e alertas inteligentes para você evoluir sem depender de achismo.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/cadastro" className="inline-flex items-center gap-2 rounded-full bg-lime-300 px-6 py-3 font-semibold text-black transition hover:bg-lime-200">
                Começar minha transformação
                <ArrowRight size={18} />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:bg-white/10">
                Já tenho conta
              </Link>
            </div>
            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
              <Proof value="597" label="alimentos brasileiros" />
              <Proof value="IA" label="plano personalizado" />
              <Proof value="Progresso" label="peso e medidas" />
            </div>
          </div>

          <div className="animate-rise-delayed">
            <DashboardPreview />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="grid gap-4 md:grid-cols-4">
          {features.map(([Icon, title, text]) => (
            <GlassCard key={title} className="group min-h-56 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-lime-300 transition group-hover:bg-lime-300 group-hover:text-black">
                <Icon size={20} />
              </div>
              <h2 className="mt-5 text-lg font-semibold">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{text}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-12 lg:grid-cols-[.85fr_1.15fr]">
        <div className="self-center">
          <p className="text-sm text-lime-300">Sem achismo</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Menos termos técnicos. Mais próxima ação.</h2>
          <p className="mt-5 text-lg leading-8 text-zinc-400">
            Se o peso trava, a cintura cai, a proteína fica baixa ou o sono piora, o Coach traduz os sinais em uma recomendação fácil de entender.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map(([number, title, text]) => (
            <div key={number} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 transition hover:border-lime-300/30 hover:bg-white/[0.07]">
              <p className="text-sm text-lime-300">{number}</p>
              <h3 className="mt-8 text-xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12">
        <div className="overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.05]">
          <div className="grid gap-0 lg:grid-cols-2">
            <div className="p-6 md:p-10">
              <p className="text-sm text-lime-300">Para usuário real</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight">Serve para quem já tem nutri e para quem está começando.</h2>
              <p className="mt-5 text-lg leading-8 text-zinc-400">
                O ShapeOS respeita dieta prescrita, permite montar refeições por alimento e ainda gera lista de compras quinzenal ou mensal.
              </p>
              <div className="mt-7 grid gap-3">
                {["Monte a dieta digitando o alimento", "Receitas com calorias por porção", "Lista de compras semanal, quinzenal ou mensal", "Favoritos e bloqueios para personalizar a IA"].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-zinc-200">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-300 text-black"><Check size={14} /></span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="min-h-96 border-t border-white/10 bg-black/35 p-6 lg:border-l lg:border-t-0">
              <MealMock />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 pb-24">
        <div className="rounded-[36px] border border-lime-300/20 bg-lime-300/10 p-6 text-center md:p-12">
          <LockKeyhole className="mx-auto text-lime-300" size={28} />
          <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
            Comece com uma meta. Continue com acompanhamento.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
            O ShapeOS não substitui médico ou nutricionista. Em diabetes, doença renal, gestação, transtornos alimentares, doença cardíaca ou uso de medicamentos, procure um profissional.
          </p>
          <Link href="/cadastro" className="mt-8 inline-flex items-center gap-2 rounded-full bg-lime-300 px-7 py-3 font-semibold text-black transition hover:bg-lime-200">
            Criar minha conta
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

    </main>
  );
}

function DashboardPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[44px] border border-lime-300/10" />
      <div className="relative rounded-[40px] border border-white/10 bg-[#111111]/90 p-4 shadow-2xl shadow-black/60 backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Image src="/shapeos-icon.png" alt="" width={40} height={40} className="rounded-2xl" />
            <div>
              <p className="font-semibold">Hoje</p>
              <p className="text-sm text-zinc-500">Gabriel, plano ativo</p>
            </div>
          </div>
          <span className="rounded-full bg-lime-300 px-3 py-1 text-sm font-semibold text-black">64%</span>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm text-zinc-500">Calorias restantes</p>
            <p className="mt-2 text-5xl font-semibold">1.842</p>
            <div className="mt-5 grid gap-3">
              <MiniBar label="Proteína" value="138/210g" pct={66} color="#7dd3fc" />
              <MiniBar label="Carbo" value="180/260g" pct={69} color="#b8ff00" />
              <MiniBar label="Gordura" value="52/94g" pct={55} color="#fbbf24" />
            </div>
          </div>
          <ProgressRing value={64} label="dia" />
        </div>
        <div className="mt-5 grid gap-3">
          <InsightCard icon={Sparkles} title="Coach" text="Seu peso estabilizou. Confira cintura antes de reduzir calorias." />
          <InsightCard icon={Scale} title="Projeção" text="-0,6 kg/semana se a tendência atual continuar." />
        </div>
      </div>
    </div>
  );
}

function MealMock() {
  const meals = [
    ["Café da manhã", "Aveia + banana + ovos", "520 kcal"],
    ["Almoço", "Arroz + feijão + frango", "780 kcal"],
    ["Pré-treino", "Whey + banana", "310 kcal"],
    ["Jantar", "Tilapia + batata doce", "610 kcal"],
  ];
  return (
    <div className="grid h-full content-center gap-3">
      {meals.map(([name, items, kcal], index) => (
        <div key={name} className="animate-float-subtle rounded-3xl border border-white/10 bg-white/[0.05] p-4" style={{ animationDelay: `${index * 140}ms` }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{name}</p>
              <p className="mt-1 text-sm text-zinc-500">{items}</p>
            </div>
            <p className="text-sm font-semibold text-zinc-200">{kcal}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Proof({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.05] px-4 py-3">
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function MiniBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-200">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function InsightCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="rounded-3xl bg-white/[0.05] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lime-300/15 text-lime-300">
          <Icon size={18} />
        </div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6 text-zinc-400">{text}</p>
        </div>
      </div>
    </div>
  );
}
