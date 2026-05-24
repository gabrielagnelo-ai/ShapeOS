import { Calculator, HeartPulse, Info, Percent, Zap } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { StatCard } from "@/components/ui/stat-card";
import { computeProfileMetrics, requireUserProfile } from "@/lib/profile";

const goalLabels = {
  fat_loss: "Perda de peso",
  maintenance: "Manutenção",
  muscle_gain: "Ganho de massa",
} as const;

export default async function CalculadorasPage() {
  const { profile } = await requireUserProfile();
  const metrics = computeProfileMetrics(profile);
  const goalDetail =
    metrics.goal === "fat_loss"
      ? `Déficit escolhido: ${profile.calorieDeficitKcal ?? 400} kcal`
      : metrics.goal === "muscle_gain"
        ? "Superávit padrão: 300 kcal"
        : "Meta igual ao gasto diário estimado";

  return (
    <AppShell>
      <h1 className="text-4xl font-semibold tracking-tight">Calculadoras</h1>
      <p className="mt-3 max-w-3xl text-zinc-400">
        Aqui estão os principais números da sua dieta em linguagem simples. As fórmulas ficam em segundo plano.
      </p>
      <div className="mt-8 grid gap-4 lg:grid-cols-4">
        <StatCard icon={Zap} label="Calorias em repouso" value={`${metrics.bmr}`} detail="Estimativa do que seu corpo gasta parado." />
        <StatCard icon={Calculator} label="Gasto diário estimado" value={`${metrics.tdee}`} detail={`Inclui seu nível de atividade (${profile.activityFactor}).`} tone="blue" />
        <StatCard icon={HeartPulse} label="IMC" value={`${metrics.bmi}`} detail="Indicador geral de peso por altura." tone="white" />
        <StatCard icon={Percent} label="Gordura estimada" value={metrics.bodyFat.percentage === null ? "Medidas pendentes" : `${metrics.bodyFat.percentage}%`} detail="Estimativa por medidas corporais." />
      </div>
      <GlassCard className="mt-4">
        <h2 className="text-xl font-semibold">Sua meta calórica atual</h2>
        <div className="mt-5 rounded-3xl bg-white/[0.04] p-5">
          <p className="text-zinc-500">{goalLabels[metrics.goal]}</p>
          <p className="mt-2 text-3xl font-semibold">{metrics.targets.calories} kcal</p>
          <p className="mt-2 text-sm text-zinc-500">{goalDetail}</p>
        </div>
        <p className="mt-5 text-sm text-zinc-500">
          A gordura corporal é uma estimativa. Para maior precisão, use avaliação profissional, bioimpedância ou dobras cutâneas.
        </p>
      </GlassCard>
      <GlassCard className="mt-4">
        <div className="flex items-start gap-3">
          <Info className="mt-1 text-lime-300" size={20} />
          <div>
            <h2 className="text-lg font-semibold">Para usuários avançados</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              BMR usa Mifflin-St Jeor. Gasto diário = calorias em repouso vezes fator de atividade. Gordura estimada usa o método da Marinha Americana quando cintura, pescoço e, para mulheres, quadril estão preenchidos.
            </p>
          </div>
        </div>
      </GlassCard>
    </AppShell>
  );
}
