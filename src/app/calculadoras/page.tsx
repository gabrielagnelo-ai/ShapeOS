import { ArrowRight, Calculator, HeartPulse, Info, Percent, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { StatCard } from "@/components/ui/stat-card";
import { bodyStateFromLatestSnapshot, recalculateBodyCompositionSnapshots } from "@/lib/body-composition";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics, requireUserProfile } from "@/lib/profile";
import type { Sex } from "@/lib/nutrition";

const goalLabels = {
  fat_loss: "Perda de peso",
  maintenance: "Manutenção",
  muscle_gain: "Ganho de massa",
} as const;

export default async function CalculadorasPage() {
  const { user, profile } = await requireUserProfile();
  const sex = (profile.sex === "MALE" ? "male" : "female") as Sex;
  const rawBodySnapshots = await prisma.bodyCompositionSnapshot.findMany({
    where: { userId: user.id },
    orderBy: { measuredAt: "desc" },
    take: 1,
  });
  const bodySnapshots = recalculateBodyCompositionSnapshots(rawBodySnapshots, { sex, heightCm: profile.heightCm });
  const currentBody = bodyStateFromLatestSnapshot(profile, bodySnapshots);
  const metrics = computeProfileMetrics(profile, currentBody);
  const bodySource = rawBodySnapshots[0]?.source === "weekly_checkin" ? "último check-in" : "perfil atual";
  const goalDetail =
    metrics.goal === "fat_loss"
      ? `Déficit escolhido: ${profile.calorieDeficitKcal ?? 400} kcal`
      : metrics.goal === "muscle_gain"
        ? "Superávit padrão: 300 kcal"
        : "Meta igual ao gasto diário estimado";

  return (
    <AppShell>
      <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:items-end">
        <div>
          <p className="text-sm font-semibold text-lime-300">Calculadoras</p>
          <h1 className="mt-3 max-w-4xl text-5xl font-semibold tracking-tight md:text-6xl">
            Seus números traduzidos para decisões simples.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-400">
            O ShapeOS usa fórmulas conhecidas por trás, mas mostra o que importa: gasto, meta, macros e limitações da estimativa.
          </p>
        </div>
        <GlassCard className="border-lime-300/25 bg-lime-300/[0.08]">
          <p className="text-sm text-zinc-400">Meta calórica atual</p>
          <p className="mt-3 text-5xl font-semibold tracking-tight">{metrics.targets.calories}</p>
          <p className="mt-2 text-sm text-lime-200">{goalLabels[metrics.goal]} - {goalDetail}</p>
          <Link href="/configuracoes" className="mt-6 inline-flex items-center gap-2 rounded-full bg-lime-300 px-4 py-2 text-sm font-semibold text-black">
            Ajustar metas
            <ArrowRight size={15} />
          </Link>
        </GlassCard>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-4">
        <StatCard icon={Zap} label="Calorias em repouso" value={`${metrics.bmr}`} detail="Estimativa do que seu corpo gasta parado." />
        <StatCard icon={Calculator} label="Gasto diário estimado" value={`${metrics.tdee}`} detail={`Inclui seu fator de atividade ${profile.activityFactor}.`} tone="blue" />
        <StatCard icon={HeartPulse} label="IMC" value={`${metrics.bmi}`} detail={`Usa ${currentBody.weightKg.toLocaleString("pt-BR")} kg do ${bodySource}.`} tone="white" />
        <StatCard icon={Percent} label="Gordura estimada" value={metrics.bodyFat.percentage === null ? "Pendente" : `${metrics.bodyFat.percentage}%`} detail="Estimativa por medidas corporais." />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <GlassCard>
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime-300/15 text-lime-300">
              <ShieldCheck size={21} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Como interpretar</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                A meta diária vem do seu gasto estimado menos ou mais o ajuste escolhido. Proteína usa 4 kcal/g, gordura usa 9 kcal/g e carboidrato fica com as calorias restantes.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MacroBox label="Proteína" value={`${metrics.targets.proteinG}g`} detail={`${metrics.targets.proteinG * 4} kcal`} />
            <MacroBox label="Carboidrato" value={`${metrics.targets.carbsG}g`} detail={`${metrics.targets.carbsG * 4} kcal`} />
            <MacroBox label="Gordura" value={`${metrics.targets.fatG}g`} detail={`${metrics.targets.fatG * 9} kcal`} />
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-start gap-3">
            <Info className="mt-1 text-lime-300" size={20} />
            <div>
              <h2 className="text-lg font-semibold">Detalhe técnico</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                BMR usa Mifflin-St Jeor. Gasto diário = BMR vezes fator de atividade. Gordura estimada usa o método da Marinha Americana quando cintura, pescoço e, para mulheres, quadril estão preenchidos.
              </p>
              <p className="mt-4 text-sm leading-6 text-zinc-500">
                A gordura corporal é uma estimativa e não substitui avaliação profissional, bioimpedância ou dobras cutâneas.
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}

function MacroBox({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-100">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}
