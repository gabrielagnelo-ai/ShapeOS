import Link from "next/link";
import { Activity, ArrowRight, Bed, Dumbbell, LineChart, Ruler, Scale, ShieldAlert, Sparkles, Target, Utensils } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { bodyStateFromLatestSnapshot, recalculateBodyCompositionSnapshots } from "@/lib/body-composition";
import { buildBodyCompositionProjection } from "@/lib/bodyCompositionEngine";
import { generateCoachInsights } from "@/lib/coach";
import { buildCoachContext, hasEnoughCoachData } from "@/lib/coach/context";
import { calendarPeriods, foodPeriodSummary } from "@/lib/period-averages";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics, requireUserProfile } from "@/lib/profile";
import { validateTdeeTrend } from "@/lib/tdee";
import { analyzeTrainingPerformance, trainingLogsFromPlans } from "@/lib/training-performance";

const goalMap = { FAT_LOSS: "fat_loss", MAINTENANCE: "maintenance", MUSCLE_GAIN: "muscle_gain" } as const;

export default async function CoachPage() {
  const { user, profile } = await requireUserProfile();
  let metrics = computeProfileMetrics(profile);
  const periods = calendarPeriods();
  const checkins = await prisma.weeklyCheckin.findMany({ where: { userId: user.id }, orderBy: { weekStart: "desc" }, take: 8 });
  const rawBodySnapshots = await prisma.bodyCompositionSnapshot.findMany({ where: { userId: user.id }, orderBy: { measuredAt: "desc" }, take: 12 });
  const bodySnapshots = recalculateBodyCompositionSnapshots(rawBodySnapshots, { sex: metrics.sex, heightCm: profile.heightCm });
  const currentBody = bodyStateFromLatestSnapshot(profile, bodySnapshots);
  metrics = computeProfileMetrics(profile, currentBody);
  const foodLogs = await prisma.foodLog.findMany({ where: { userId: user.id }, include: { items: { include: { food: true } } }, orderBy: { date: "desc" }, take: 7 });
  const periodFoodLogs = await prisma.foodLog.findMany({
    where: { userId: user.id, date: { gte: periods.semester.start, lt: periods.semester.end } },
    include: { items: { include: { food: true } } },
    orderBy: { date: "desc" },
  });
  const trainingPlans = await prisma.trainingPlan.findMany({
    where: { userId: user.id },
    include: {
      days: {
        include: {
          exercises: {
            include: { logs: { where: { userId: user.id }, orderBy: { date: "desc" }, take: 4 } },
          },
        },
      },
    },
    take: 12,
  });
  const foodMonth = foodPeriodSummary(periodFoodLogs.map((log) => ({
    date: log.date,
    items: log.items.map((item) => ({
      grams: item.grams,
      food: {
        name: item.food.name,
        kcalPer100g: item.food.kcalPer100g,
        proteinPer100g: item.food.proteinPer100g,
        carbsPer100g: item.food.carbsPer100g,
        fatPer100g: item.food.fatPer100g,
        fiberPer100g: item.food.fiberPer100g ?? 0,
        sodiumPer100g: item.food.sodiumPer100g ?? 0,
        calciumPer100g: item.food.calciumPer100g ?? 0,
        ironPer100g: item.food.ironPer100g ?? 0,
        magnesiumPer100g: item.food.magnesiumPer100g ?? 0,
        potassiumPer100g: item.food.potassiumPer100g ?? 0,
        zincPer100g: item.food.zincPer100g ?? 0,
        vitaminCPer100g: item.food.vitaminCPer100g ?? 0,
        vitaminDPer100g: item.food.vitaminDPer100g ?? 0,
        vitaminB12Per100g: item.food.vitaminB12Per100g ?? 0,
      },
    })),
  })), periods.month);
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
    averageIntakeKcal: Math.round(foodMonth.average.kcal),
    checkins: [...checkins].reverse(),
  });
  const topInsight = insights[0];
  const trainingPerformance = analyzeTrainingPerformance(trainingLogsFromPlans(trainingPlans));
  const latestCheckin = checkins[0];
  const bodyComposition = buildBodyCompositionProjection({
    currentWeightKg: latestCheckin?.averageWeightKg ?? currentBody.weightKg,
    currentWaistCm: latestCheckin?.waistCm ?? currentBody.waistCm,
    currentBodyFatPct: bodySnapshots[0]?.bodyFatPct ?? metrics.bodyFat.percentage,
    targetWaistCm: profile.targetWaistCm,
    targetBodyFatPct: profile.targetBodyFatPct,
    targetDate: profile.targetDate,
    checkins: [...checkins].reverse(),
    snapshots: bodySnapshots,
    proteinHitRate: proteinHitRate(foodMonth.dayTotals, metrics.targets.proteinG),
    deficitPct: context.currentDeficitPct,
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
            <Signal icon={<LineChart size={18} />} label="Composição" value={bodyComposition.targetBodyFatPct ? `${formatNumber(bodyComposition.targetBodyFatPct)}% BF` : "pendente"} detail={`confiança ${bodyComposition.confidenceLabel}`} />
            <Signal icon={<Dumbbell size={18} />} label="Performance" value={`${trainingPerformance.score}`} detail={trainingCoachDetail(trainingPerformance)} />
            <Signal icon={<Bed size={18} />} label="Sono" value={latestCheckin ? `${latestCheckin.sleep}/10` : "sem dado"} detail={context.sleepTrend === "down" ? "queda recente" : "sem queda detectada"} />
          </div>
        </GlassCard>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {trainingPerformance.alerts.slice(0, 1).map((alert) => (
          <GlassCard key={`training-${alert.type}`} className={alert.type === "drop" || alert.type === "fatigue" ? "border-amber-300/30 bg-amber-300/[0.06]" : "border-lime-300/30 bg-lime-300/[0.06]"}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-lime-300">
                  <Dumbbell size={18} />
                </div>
                <div>
                  <p className="text-sm text-lime-300">treino</p>
                  <h3 className="text-lg font-semibold">Performance de carga</h3>
                </div>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-400">score {trainingPerformance.score}</span>
            </div>
            <p className="mt-5 text-lg leading-8">{alert.message}</p>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{trainingPerformance.primaryMessage}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/treinos" className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/15">
                Ver treinos
              </Link>
              <Link href="/acompanhamento" className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/15">
                Atualizar check-in
              </Link>
            </div>
          </GlassCard>
        ))}
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
              Projeções usam BF alvo, cintura, massa magra estimada e tendência real. Peso é consequência da composição, não a meta principal.
            </p>
          </div>
          <Link href="/acompanhamento" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15">
            Atualizar check-in
            <ArrowRight size={15} />
          </Link>
        </div>

        {bodyComposition.scenarios.length ? (
          <>
          <BodyFatRangeBar projection={bodyComposition} />
          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            <ProjectionCard
              icon={<Dumbbell size={18} />}
              label="Massa magra estimada"
              value={bodyComposition.currentLeanMassKg == null ? "pendente" : `${formatNumber(bodyComposition.currentLeanMassKg)} kg`}
              detail={bodyComposition.muscleSignal.label}
              tone={bodyComposition.muscleSignal.score >= 55 ? "good" : "warning"}
            />
            <ProjectionCard
              icon={<Ruler size={18} />}
              label="Cintura"
              value={bodyComposition.trends.waistCmPerWeek == null ? "sem tendência" : `${formatSigned(bodyComposition.trends.waistCmPerWeek)} cm/sem`}
              detail={bodyComposition.recomposition.message}
              tone={bodyComposition.recomposition.detected ? "good" : "neutral"}
            />
            <ProjectionCard
              icon={<ShieldAlert size={18} />}
              label="Confiança corporal"
              value={bodyComposition.confidenceLabel}
              detail="baseada em check-ins, cintura, BF e frequência de dados"
              tone={bodyComposition.confidenceLabel === "alta" ? "good" : bodyComposition.confidenceLabel === "media" ? "warning" : "danger"}
            />
            <ProjectionCard
              icon={<Activity size={18} />}
              label="Massa gorda atual"
              value={bodyComposition.currentFatMassKg == null ? "pendente" : `${formatNumber(bodyComposition.currentFatMassKg)} kg`}
              detail={bodyComposition.fatMassToLoseKg == null ? "defina BF alvo para estimar gordura a perder" : `${formatNumber(bodyComposition.fatMassToLoseKg)} kg estimados até o alvo`}
              tone="neutral"
            />
            <ProjectionCard
              icon={<Target size={18} />}
              label="Massa gorda alvo"
              value={bodyComposition.targetFatMassKg == null ? "pendente" : `${formatNumber(bodyComposition.targetFatMassKg)} kg`}
              detail="calculada pelo BF alvo e pela massa magra estimada"
              tone="good"
            />
            <ProjectionCard
              icon={<Scale size={18} />}
              label="Faixa provável"
              value={bodyComposition.probableWeightRangeKg == null ? "pendente" : `${formatNumber(bodyComposition.probableWeightRangeKg.minKg)}-${formatNumber(bodyComposition.probableWeightRangeKg.maxKg)} kg`}
              detail="inclui variação esperada de água, glicogênio e retenção"
              tone="neutral"
            />
            {bodyComposition.scenarios.map((scenario) => (
              <ProjectionCard
                key={scenario.key}
                icon={scenario.key === "aggressive" ? <Activity size={18} /> : scenario.key === "realistic" ? <Target size={18} /> : <Scale size={18} />}
                label={scenario.label}
                value={scenario.estimatedDate ? scenario.estimatedDate.toLocaleDateString("pt-BR") : "pendente"}
                detail={`${formatNumber(scenario.bodyFatPct)}% BF, ${scenario.projectedWeightKg ? `${formatNumber(scenario.projectedWeightKg)} kg` : "peso pendente"}, LBM ${scenario.projectedLeanMassKg ? formatNumber(scenario.projectedLeanMassKg) : "?"} kg. Confiança ${scenario.confidence}.`}
                tone={scenario.key === "aggressive" ? "warning" : scenario.key === "realistic" ? "good" : "neutral"}
              />
            ))}
          </div>
          </>
        ) : (
          <div className="mt-6 rounded-3xl bg-black/25 p-5">
            <p className="font-semibold">Ainda falta histórico.</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Defina um BF alvo em Metas e registre cintura semanalmente. O ShapeOS vai projetar o físico por massa magra, BF e cintura.
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
    <div className="flex flex-col gap-3 rounded-3xl bg-black/25 p-4 sm:flex-row sm:items-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-lime-300">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-500">{label}</p>
        <p className="mt-1 font-semibold">{value}</p>
      </div>
      <p className="text-xs leading-5 text-zinc-500 sm:max-w-36 sm:text-right">{detail}</p>
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

function proteinHitRate(days: Array<{ totals: { proteinG: number } }>, targetProteinG: number) {
  if (!days.length || !targetProteinG) return null;
  const hitDays = days.filter((day) => day.totals.proteinG >= targetProteinG * 0.9).length;
  return hitDays / days.length;
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

function BodyFatRangeBar({ projection }: { projection: ReturnType<typeof buildBodyCompositionProjection> }) {
  const { currentBodyFatPct, targetBodyFatPct, progressPct } = projection.bodyFatProgress;
  if (currentBodyFatPct == null || targetBodyFatPct == null) return null;

  return (
    <div className="mt-6 rounded-3xl border border-lime-300/20 bg-lime-300/[0.05] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-lime-200">Linha de BF</p>
          <p className="mt-1 text-xs text-zinc-500">Recalcula automaticamente conforme novos check-ins corporais entram.</p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-400" title="A confiança aumenta conforme mais check-ins corporais são registrados.">
          confiança {projection.confidenceLabel}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="w-12 text-sm font-semibold">{formatNumber(currentBodyFatPct)}%</span>
        <div className="relative h-2 flex-1 rounded-full bg-white/10">
          <div className="absolute inset-y-0 left-0 rounded-full bg-lime-300/70" style={{ width: `${progressPct}%` }} />
          <div className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-lime-300 shadow-[0_0_22px_rgba(184,255,0,.45)]" style={{ left: `${progressPct}%` }} />
        </div>
        <span className="w-12 text-right text-sm font-semibold text-lime-200">{formatNumber(targetBodyFatPct)}%</span>
      </div>
    </div>
  );
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

function confidenceLabel(value: string) {
  const labels: Record<string, string> = {
    HIGH: "alta",
    MEDIUM: "media",
    LOW: "baixa",
  };

  return labels[value] ?? "media";
}

function trainingCoachDetail(performance: ReturnType<typeof analyzeTrainingPerformance>) {
  if (performance.trend === "improving") return `${performance.improvedExercises} subindo`;
  if (performance.trend === "declining") return `${performance.declinedExercises} caindo`;
  if (performance.trend === "stable") return "estável";
  return "poucos dados";
}
