import Link from "next/link";
import { Activity, ArrowRight, Bed, Dumbbell, LineChart, Ruler, Scale, ShieldAlert, Sparkles, Utensils } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { buildBodyGoalProjection } from "@/lib/body-goal";
import { generateCoachInsights } from "@/lib/coach";
import { buildCoachContext, hasEnoughCoachData } from "@/lib/coach/context";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics, requireUserProfile } from "@/lib/profile";
import { validateTdeeTrend } from "@/lib/tdee";

const goalMap = { FAT_LOSS: "fat_loss", MAINTENANCE: "maintenance", MUSCLE_GAIN: "muscle_gain" } as const;

export default async function CoachPage() {
  const { user, profile } = await requireUserProfile();
  const metrics = computeProfileMetrics(profile);
  const checkins = await prisma.weeklyCheckin.findMany({ where: { userId: user.id }, orderBy: { weekStart: "desc" }, take: 8 });
  const bodySnapshots = await prisma.bodyCompositionSnapshot.findMany({ where: { userId: user.id }, orderBy: { measuredAt: "desc" }, take: 12 });
  const foodLogs = await prisma.foodLog.findMany({ where: { userId: user.id }, include: { items: { include: { food: true } } }, orderBy: { date: "desc" }, take: 7 });
  const context = buildCoachContext({
    goal: goalMap[profile.goal],
    tdee: metrics.tdee,
    targetCalories: metrics.targets.calories,
    proteinTargetG: metrics.targets.proteinG,
    foodLogs,
    checkins,
  });
  const insights = hasEnoughCoachData(context) ? generateCoachInsights(context) : [];
  const tdeeValidation = validateTdeeTrend({
    tdee: metrics.tdee,
    averageIntakeKcal: averageFoodLogCalories(foodLogs),
    checkins: [...checkins].reverse(),
  });
  const topInsight = insights[0];
  const latestCheckin = checkins[0];
  const projections = buildProjections({
    checkins,
    snapshots: bodySnapshots,
    currentWeightKg: latestCheckin?.averageWeightKg ?? profile.weightKg,
    currentWaistCm: latestCheckin?.waistCm ?? profile.waistCm,
    bodyFatPct: bodySnapshots[0]?.bodyFatPct ?? metrics.bodyFat.percentage,
  });
  const bodyGoal = buildBodyGoalProjection({
    currentWeightKg: latestCheckin?.averageWeightKg ?? profile.weightKg,
    currentWaistCm: latestCheckin?.waistCm ?? profile.waistCm,
    currentBodyFatPct: bodySnapshots[0]?.bodyFatPct ?? metrics.bodyFat.percentage,
    targetWeightKg: profile.targetWeightKg,
    targetWaistCm: profile.targetWaistCm,
    targetBodyFatPct: profile.targetBodyFatPct,
    targetDate: profile.targetDate,
    checkins: [...checkins].reverse(),
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-lime-300">Coach IA</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">ShapeOS Coach</h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Um painel silencioso de sinais. Ele cruza diário, check-ins, déficit e metas para sugerir o próximo ajuste.
          </p>
        </div>
        <div className="rounded-3xl border border-lime-300/20 bg-lime-300/10 px-5 py-4 text-right">
          <p className="text-2xl font-semibold text-lime-200">{insights.length}</p>
          <p className="text-xs text-zinc-400">sinais ativos</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <GlassCard className="border-lime-300/30">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-300/15 text-lime-300">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Recomendação principal</p>
              <h2 className="text-xl font-semibold">{topInsight ? insightTitle(topInsight.trigger) : "Sem ajuste urgente"}</h2>
            </div>
          </div>
          <p className="mt-6 text-2xl font-semibold leading-9">
            {topInsight?.message ?? "Continue registrando refeições e check-ins. O Coach precisa de dados reais antes de sugerir ajustes."}
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
            {topInsight ? insightExplanation(topInsight.trigger, context) : "Com pelo menos alguns dias de diário e dois check-ins semanais, os alertas passam a refletir tendência, não chute."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {(topInsight ? insightActions(topInsight.trigger) : defaultActions()).map((action) => (
              <Link key={action.href} href={action.href} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15">
                {action.label}
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-xl font-semibold">Leitura atual</h2>
          <div className="mt-5 grid gap-3">
            <Signal icon={<Activity size={18} />} label="Redução de calorias" value={`${context.currentDeficitPct}%`} detail={`${metrics.targets.calories} kcal alvo / ${metrics.tdee} kcal gasto estimado`} />
            <Signal icon={<ShieldAlert size={18} />} label="Confiança TDEE" value={confidenceLabel(tdeeValidation.confidence)} detail={tdeeValidation.message} />
            <Signal icon={<Utensils size={18} />} label="Proteína alvo" value={`${metrics.targets.proteinG}g`} detail={proteinDetail(context.proteinLast3DaysPct)} />
            <Signal icon={<Scale size={18} />} label="Peso" value={latestCheckin ? `${latestCheckin.averageWeightKg} kg` : "sem check-in"} detail={context.weightStableDays ? "estável nas últimas 2 semanas" : "sem platô detectado"} />
            <Signal icon={<LineChart size={18} />} label="Meta corporal" value={bodyGoal.estimatedDate ? bodyGoal.estimatedDate.toLocaleDateString("pt-BR") : "pendente"} detail={bodyGoal.hasGoal ? bodyGoal.paceLabel : "defina em metas"} />
            <Signal icon={<Bed size={18} />} label="Sono" value={latestCheckin ? `${latestCheckin.sleep}/10` : "sem dado"} detail={context.sleepTrend === "down" ? "queda recente" : "sem queda detectada"} />
          </div>
        </GlassCard>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {insights.length ? insights.map((insight) => (
          <GlassCard key={insight.trigger}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-lime-300">
                  {categoryIcon(insight.category)}
                </div>
                <div>
                  <p className="text-sm capitalize text-lime-300">{categoryLabel(insight.category)}</p>
                  <h3 className="text-lg font-semibold">{insightTitle(insight.trigger)}</h3>
                </div>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-400">prioridade {insight.priority}</span>
            </div>
            <p className="mt-5 text-lg leading-8">{insight.message}</p>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{insightExplanation(insight.trigger, context)}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {insightActions(insight.trigger).map((action) => (
                <Link key={action.href} href={action.href} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/15">
                  {action.label}
                </Link>
              ))}
            </div>
          </GlassCard>
        )) : (
          <GlassCard>
            <div className="flex items-center gap-3">
              <ShieldAlert className="text-lime-300" />
              <h2 className="text-xl font-semibold">Sem alertas agora</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              Registre alimentos por alguns dias e faça check-ins semanais para o Coach avaliar proteína, déficit, sono, peso e aderência.
            </p>
          </GlassCard>
        )}
      </div>

      <GlassCard className="mt-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-300/15 text-lime-300">
                <LineChart size={20} />
              </div>
              <div>
                <p className="text-sm text-lime-300">Projeções</p>
                <h2 className="text-xl font-semibold">Tendência corporal</h2>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
              Projeções usam seus check-ins. Registre peso e cintura semanalmente para ver tendências mais confiáveis.
            </p>
          </div>
          <Link href="/acompanhamento" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15">
            Atualizar check-in
            <ArrowRight size={15} />
          </Link>
        </div>

        {projections.ready ? (
          <div className="mt-6 grid gap-3 lg:grid-cols-5">
            <ProjectionCard
              icon={<Scale size={18} />}
              label="Peso"
              value={`${formatSigned(projections.weightChangePerWeekKg)} kg/sem`}
              detail={`Em 4 semanas: ${formatNumber(projections.projectedWeight4wKg)} kg`}
              tone={projectionTone(projections.weightLossPctPerWeek)}
            />
            <ProjectionCard
              icon={<Ruler size={18} />}
              label="Cintura"
              value={projections.waistChangePerWeekCm == null ? "sem dados" : `${formatSigned(projections.waistChangePerWeekCm)} cm/sem`}
              detail={projections.projectedWaist4wCm == null ? "registre cintura nos check-ins" : `Em 4 semanas: ${formatNumber(projections.projectedWaist4wCm)} cm`}
              tone="neutral"
            />
            <ProjectionCard
              icon={<Activity size={18} />}
              label="BF estimado"
              value={projections.bodyFatPct == null ? "pendente" : `${formatNumber(projections.bodyFatPct)}%`}
              detail={projections.bodyFatChangePerWeekPct == null ? "precisa histórico de medidas" : `${formatSigned(projections.bodyFatChangePerWeekPct)} p.p./sem`}
              tone="neutral"
            />
            <ProjectionCard
              icon={<Dumbbell size={18} />}
              label="Massa magra est."
              value={projections.leanMassKg == null ? "pendente" : `${formatNumber(projections.leanMassKg)} kg`}
              detail={projections.leanMassChangePerWeekKg == null ? "precisa histórico de BF" : `${formatSigned(projections.leanMassChangePerWeekKg)} kg/sem`}
              tone={leanMassTone(projections.leanMassChangePerWeekKg)}
            />
            <ProjectionCard
              icon={<ShieldAlert size={18} />}
              label="Conferencia"
              value={projectionLabel(projections.weightLossPctPerWeek)}
              detail={projectionMessage(projections)}
              tone={projectionTone(projections.weightLossPctPerWeek)}
            />
          </div>
        ) : (
          <div className="mt-6 rounded-3xl bg-black/25 p-5">
            <p className="font-semibold">Ainda falta histórico.</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Faça pelo menos dois check-ins semanais com peso médio. Para cintura e massa magra estimada, informe cintura e medidas de BF nas configurações.
            </p>
            <Link href="/acompanhamento" className="mt-4 inline-flex rounded-full bg-lime-300 px-4 py-2 text-sm font-semibold text-black">
              Registrar peso e medidas
            </Link>
          </div>
        )}

        {bodySnapshots.length ? (
          <div className="mt-6">
            <p className="text-sm font-medium text-zinc-300">Histórico recente de BF</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {bodySnapshots.slice(0, 6).map((snapshot) => (
                <div key={snapshot.id} className="rounded-2xl bg-black/25 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">{snapshot.measuredAt.toLocaleDateString("pt-BR")}</span>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-zinc-400">{snapshotSource(snapshot.source)}</span>
                  </div>
                  <p className="mt-2 font-semibold text-zinc-100">{snapshot.bodyFatPct == null ? "BF pendente" : `${formatNumber(snapshot.bodyFatPct)}% BF`}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatNumber(snapshot.weightKg)} kg
                    {snapshot.waistCm ? ` - cintura ${formatNumber(snapshot.waistCm)} cm` : ""}
                    {snapshot.leanMassKg ? ` - MM ${formatNumber(snapshot.leanMassKg)} kg` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </GlassCard>
    </AppShell>
  );
}

function Signal({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-black/25 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-lime-300">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-500">{label}</p>
        <p className="mt-1 font-semibold">{value}</p>
      </div>
      <p className="max-w-36 text-right text-xs leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}

function insightTitle(trigger: string) {
  const titles: Record<string, string> = {
    protein_drop_3d: "Proteína abaixo da meta",
    weight_plateau_14d: "Peso em platô",
    adherence_streak_5d: "Consistência forte",
    sleep_decline: "Sono em queda",
    aggressive_deficit: "Redução calórica alta",
    training_low: "Treino baixo",
    micros_low: "Micronutrientes baixos",
  };
  return titles[trigger] ?? "Sinal detectado";
}

function insightExplanation(trigger: string, context: ReturnType<typeof buildCoachContext>) {
  const explanations: Record<string, string> = {
    protein_drop_3d: `Nos últimos registros, a proteína ficou em ${context.proteinLast3DaysPct.join("%, ")}% da meta. Ajustar isso ajuda saciedade e preservação de massa magra.`,
    weight_plateau_14d: "O peso médio mudou menos que 0,2 kg entre os dois últimos check-ins. Se a aderência estiver boa, pode ser hora de revisar calorias.",
    adherence_streak_5d: "Quando calorias e proteína ficam dentro da faixa por vários dias, o melhor ajuste geralmente é manter o plano antes de mexer.",
    sleep_decline: "Sono menor costuma aumentar fome, reduzir recuperação e piorar treino. Antes de cortar calorias, vale corrigir rotina.",
    aggressive_deficit: `Sua meta está cerca de ${context.currentDeficitPct}% abaixo do seu gasto diário estimado. Para muita gente, isso pode aumentar fome, cansaço no treino e risco de perder massa magra.`,
    training_low: "Pouco treino reduz o sinal para manter ou ganhar massa. Ajustar agenda pode ser mais importante do que mexer na dieta.",
    micros_low: "Variedade baixa no diário pode deixar vitaminas e minerais para trás. Frutas, verduras, leguminosas e laticínios ajudam a fechar lacunas.",
  };
  return explanations[trigger] ?? "Sinal calculado a partir dos dados registrados no app.";
}

function insightActions(trigger: string) {
  const actions: Record<string, Array<{ label: string; href: string }>> = {
    protein_drop_3d: [{ label: "Ajustar dieta", href: "/dieta" }, { label: "Ver diário", href: "/diario" }],
    weight_plateau_14d: [{ label: "Ajustar metas", href: "/configuracoes" }, { label: "Novo check-in", href: "/acompanhamento" }],
    adherence_streak_5d: [{ label: "Manter plano", href: "/dashboard" }, { label: "Ver progresso", href: "/acompanhamento" }],
    sleep_decline: [{ label: "Registrar check-in", href: "/acompanhamento" }, { label: "Ver dashboard", href: "/dashboard" }],
    aggressive_deficit: [{ label: "Ajustar calorias", href: "/configuracoes" }, { label: "Conferir dieta", href: "/dieta" }],
    training_low: [{ label: "Check-in semanal", href: "/acompanhamento" }],
    micros_low: [{ label: "Buscar alimentos", href: "/alimentos" }, { label: "Ajustar dieta", href: "/dieta" }],
  };
  return actions[trigger] ?? defaultActions();
}

function defaultActions() {
  return [{ label: "Registrar diário", href: "/diario" }, { label: "Fazer check-in", href: "/acompanhamento" }];
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    nutrition: "nutrição",
    weight: "peso",
    sleep: "sono",
    adherence: "aderência",
    training: "treino",
  };
  return labels[category] ?? category;
}

function categoryIcon(category: string) {
  if (category === "weight") return <Scale size={18} />;
  if (category === "sleep") return <Bed size={18} />;
  if (category === "training") return <Dumbbell size={18} />;
  if (category === "adherence") return <Activity size={18} />;
  return <Utensils size={18} />;
}

function proteinDetail(values: number[]) {
  if (!values.length) return "registre 3 dias para avaliar";
  return `${values.join("%, ")}% nos últimos dias`;
}

function ProjectionCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "good" | "warning" | "danger" | "neutral";
}) {
  const color =
    tone === "danger"
      ? "border-red-400/30 bg-red-400/10 text-red-100"
      : tone === "warning"
        ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
        : tone === "good"
          ? "border-lime-300/30 bg-lime-300/10 text-lime-100"
          : "border-white/10 bg-black/25 text-zinc-100";

  return (
    <div className={`rounded-3xl border p-4 ${color}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">{icon}</div>
        <p className="text-sm text-zinc-400">{label}</p>
      </div>
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-sm leading-5 text-zinc-400">{detail}</p>
    </div>
  );
}

function buildProjections(input: {
  checkins: Array<{ averageWeightKg: number; waistCm: number | null; weekStart: Date }>;
  snapshots: Array<{
    measuredAt: Date;
    weightKg: number;
    waistCm: number | null;
    bodyFatPct: number | null;
    leanMassKg: number | null;
    fatMassKg: number | null;
  }>;
  currentWeightKg: number;
  currentWaistCm?: number | null;
  bodyFatPct: number | null;
}) {
  const orderedSnapshots = [...input.snapshots].sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());
  const orderedCheckins = [...input.checkins].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  const weightSeries = orderedSnapshots.length >= 2
    ? orderedSnapshots.map((item) => ({ date: item.measuredAt, value: item.weightKg }))
    : orderedCheckins.map((item) => ({ date: item.weekStart, value: item.averageWeightKg }));
  if (weightSeries.length < 2) return { ready: false as const };

  const first = weightSeries[0];
  const last = weightSeries[weightSeries.length - 1];
  const weeks = weeksBetween(first.date, last.date);
  const weightChangePerWeekKg = (last.value - first.value) / weeks;
  const weightLossPctPerWeek = input.currentWeightKg > 0 ? (-weightChangePerWeekKg / input.currentWeightKg) * 100 : 0;

  const waistEntries = orderedSnapshots.length >= 2
    ? orderedSnapshots.filter((snapshot) => typeof snapshot.waistCm === "number").map((snapshot) => ({ date: snapshot.measuredAt, value: snapshot.waistCm! }))
    : orderedCheckins.filter((checkin) => typeof checkin.waistCm === "number").map((checkin) => ({ date: checkin.weekStart, value: checkin.waistCm! }));
  const waistTrend = waistEntries.length >= 2
    ? (waistEntries[waistEntries.length - 1].value - waistEntries[0].value) / weeksBetween(waistEntries[0].date, waistEntries[waistEntries.length - 1].date)
    : null;

  const bfEntries = orderedSnapshots.filter((snapshot) => typeof snapshot.bodyFatPct === "number");
  const leanEntries = orderedSnapshots.filter((snapshot) => typeof snapshot.leanMassKg === "number");
  const latestSnapshot = orderedSnapshots[orderedSnapshots.length - 1];
  const leanMassKg = latestSnapshot?.leanMassKg ?? (input.bodyFatPct == null ? null : input.currentWeightKg * (1 - input.bodyFatPct / 100));
  const fatMassKg = latestSnapshot?.fatMassKg ?? (input.bodyFatPct == null ? null : input.currentWeightKg * (input.bodyFatPct / 100));
  const bodyFatPct = latestSnapshot?.bodyFatPct ?? input.bodyFatPct;
  const bodyFatChangePerWeekPct = bfEntries.length >= 2
    ? (bfEntries[bfEntries.length - 1].bodyFatPct! - bfEntries[0].bodyFatPct!) / weeksBetween(bfEntries[0].measuredAt, bfEntries[bfEntries.length - 1].measuredAt)
    : null;
  const leanMassChangePerWeekKg = leanEntries.length >= 2
    ? (leanEntries[leanEntries.length - 1].leanMassKg! - leanEntries[0].leanMassKg!) / weeksBetween(leanEntries[0].measuredAt, leanEntries[leanEntries.length - 1].measuredAt)
    : null;

  return {
    ready: true as const,
    weightChangePerWeekKg,
    weightLossPctPerWeek,
    projectedWeight4wKg: input.currentWeightKg + weightChangePerWeekKg * 4,
    waistChangePerWeekCm: waistTrend,
    projectedWaist4wCm: waistTrend == null || !input.currentWaistCm ? null : input.currentWaistCm + waistTrend * 4,
    bodyFatPct,
    bodyFatChangePerWeekPct,
    leanMassKg,
    fatMassKg,
    leanMassChangePerWeekKg,
  };
}

function weeksBetween(start: Date, end: Date) {
  return Math.max(1, (end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function projectionTone(weightLossPctPerWeek: number) {
  if (weightLossPctPerWeek > 1) return "danger" as const;
  if (weightLossPctPerWeek >= 0.5) return "good" as const;
  if (weightLossPctPerWeek > 0) return "warning" as const;
  return "neutral" as const;
}

function projectionLabel(weightLossPctPerWeek: number) {
  if (weightLossPctPerWeek > 1) return "muito rápido";
  if (weightLossPctPerWeek >= 0.5) return "boa faixa";
  if (weightLossPctPerWeek > 0) return "conservador";
  return "sem perda";
}

function projectionMessage(projections: ReturnType<typeof buildProjections>) {
  if (!projections.ready) return "faltam check-ins";
  if (projections.weightLossPctPerWeek > 1) return "ritmo rápido; acompanhe fome, treino e medidas";
  if (projections.weightLossPctPerWeek >= 0.5) return "ritmo coerente para cutting";
  if (projections.weightLossPctPerWeek > 0) return "perda lenta, boa se aderência estiver difícil";
  if ((projections.waistChangePerWeekCm ?? 0) < 0) return "peso estável com cintura caindo pode indicar recomposição";
  return "se o objetivo é perda, revise aderência e calorias";
}

function leanMassTone(value: number | null) {
  if (value == null) return "neutral" as const;
  if (value < -0.2) return "warning" as const;
  if (value >= 0) return "good" as const;
  return "neutral" as const;
}

function snapshotSource(value: string) {
  const labels: Record<string, string> = {
    onboarding: "início",
    profile_update: "medidas",
    weekly_checkin: "check-in",
  };
  return labels[value] ?? value;
}

function formatSigned(value: number) {
  const rounded = formatNumber(value);
  return value > 0 ? `+${rounded}` : rounded;
}

function formatNumber(value: number) {
  return (Math.round(value * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function averageFoodLogCalories(logs: Array<{ items: Array<{ grams: number; food: { kcalPer100g: number } }> }>) {
  const days = logs.filter((log) => log.items.length);
  if (!days.length) return 0;

  const total = days.reduce((sum, log) => (
    sum + log.items.reduce((dayTotal, item) => dayTotal + (item.food.kcalPer100g * item.grams) / 100, 0)
  ), 0);

  return Math.round(total / days.length);
}

function confidenceLabel(value: string) {
  const labels: Record<string, string> = {
    HIGH: "alta",
    MEDIUM: "media",
    LOW: "baixa",
  };

  return labels[value] ?? "media";
}
