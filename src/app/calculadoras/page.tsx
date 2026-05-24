import { Calculator, HeartPulse, Percent, Zap } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { StatCard } from "@/components/ui/stat-card";
import { computeProfileMetrics, requireUserProfile } from "@/lib/profile";

const goalLabels = {
  fat_loss: "Perda de peso",
  maintenance: "Manutencao",
  muscle_gain: "Ganho de massa",
} as const;

export default async function CalculadorasPage() {
  const { profile } = await requireUserProfile();
  const metrics = computeProfileMetrics(profile);
  const goalDetail =
    metrics.goal === "fat_loss"
      ? `Deficit escolhido: ${profile.calorieDeficitKcal ?? 400} kcal`
      : metrics.goal === "muscle_gain"
        ? "Superavit padrao: 300 kcal"
        : "Meta igual ao TDEE estimado";
  const bodyFatFormula =
    metrics.sex === "male"
      ? "US Navy: 86.010*log10(cintura-pescoco) - 70.041*log10(altura) + 36.76"
      : "US Navy: 163.205*log10(cintura+quadril-pescoco) - 97.684*log10(altura) - 78.387";

  return (
    <AppShell>
      <h1 className="text-4xl font-semibold tracking-tight">Calculadoras</h1>
      <p className="mt-3 max-w-3xl text-zinc-400">Mifflin-St Jeor para BMR, TDEE por fator de atividade, IMC e percentual de gordura estimado com limitacao explicita.</p>
      <div className="mt-8 grid gap-4 lg:grid-cols-4">
        <StatCard icon={Zap} label="BMR" value={`${metrics.bmr}`} detail={metrics.sex === "male" ? "10*peso + 6.25*altura - 5*idade + 5" : "10*peso + 6.25*altura - 5*idade - 161"} />
        <StatCard icon={Calculator} label="TDEE" value={`${metrics.tdee}`} detail={`BMR * fator ${profile.activityFactor}`} tone="blue" />
        <StatCard icon={HeartPulse} label="IMC" value={`${metrics.bmi}`} detail={`${profile.weightKg} kg / ${profile.heightCm} cm`} tone="white" />
        <StatCard icon={Percent} label="Gordura estimada" value={metrics.bodyFat.percentage === null ? "Medidas pendentes" : `${metrics.bodyFat.percentage}%`} detail={bodyFatFormula} />
      </div>
      <GlassCard className="mt-4">
        <h2 className="text-xl font-semibold">Sua meta calorica atual</h2>
        <div className="mt-5 rounded-3xl bg-white/[0.04] p-5">
          <p className="text-zinc-500">{goalLabels[metrics.goal]}</p>
          <p className="mt-2 text-3xl font-semibold">{metrics.targets.calories} kcal</p>
          <p className="mt-2 text-sm text-zinc-500">{goalDetail}</p>
        </div>
        <p className="mt-5 text-sm text-zinc-500">
          Gordura estimada pelo metodo da Marinha Americana: {metrics.bodyFat.limitation}
        </p>
      </GlassCard>
    </AppShell>
  );
}
