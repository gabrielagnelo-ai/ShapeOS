import { PageHeading } from "@/components/ui/page-heading";
import Link from "next/link";
import { Activity, ArrowRight, Bed, Compass, Dumbbell, LineChart, Ruler, Scale, ShieldAlert, Target, Utensils, type LucideIcon } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { IconTile, type TileColour } from "@/components/ui/group";
import { bodyStateFromLatestSnapshot, recalculateBodyCompositionSnapshots } from "@/lib/body-composition";
import { buildBodyCompositionProjection } from "@/lib/bodyCompositionEngine";
import { generateCoachInsights } from "@/lib/coach";
import { buildCoachContext, hasEnoughCoachData } from "@/lib/coach/context";
import { calendarPeriods, foodPeriodSummary, proteinHitRate } from "@/lib/period-averages";
import { toFoodNutrients } from "@/lib/nutrition";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics, requireUserProfile } from "@/lib/profile";
import { validateTdeeTrend } from "@/lib/tdee";
import { analyzeTrainingPerformance, trainingLogsFromPlans } from "@/lib/training-performance";
import styles from "./coach.module.css";
import { confidenceLabel, formatNumber } from "@/lib/common";

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
      food: toFoodNutrients(item.food),
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
      <div className={styles.page}>
        <PageHeading title="Coach" description="Sugestões calculadas a partir da alimentação, dos treinos e dos seus check-ins."><strong>{insights.length}</strong> sinais ativos</PageHeading>

        <section className={`${styles.panel} ${styles.recommendation}`} aria-labelledby="coach-recommendation">
          <div className={styles.recommendationContent}>
            <div className={styles.sectionHeading}>
              <IconTile icon={Compass} colour="brand" size="lg" />
              <div>
                <h2 id="coach-recommendation">{topInsight ? insightTitle(topInsight.trigger) : hasEnoughCoachData(context) ? "Nenhum ajuste indicado" : "Histórico em formação"}</h2>
              </div>
            </div>
            <p className={styles.recommendationMessage}>
              {topInsight?.message ?? "Continue registrando refeições e check-ins. O Coach precisa de dados reais antes de sugerir ajustes."}
            </p>
            <p className={styles.explanation}>
              {topInsight ? insightExplanation(topInsight.trigger, context) : "Registre a alimentação por alguns dias e faça dois check-ins semanais para começar a comparar sua evolução."}
            </p>
          </div>
          <div className={styles.primaryActions}>
            {(topInsight ? insightActions(topInsight.trigger) : defaultActions()).map((action, index) => (
              <Link key={action.href} href={action.href} className={index === 0 ? styles.primaryButton : styles.secondaryButton}>
                {action.label}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="coach-readings">
          <h2 id="coach-readings">Leitura atual</h2>
          <div className={styles.signalGroups}>
            <div className={styles.signalGroup}>
              <h3>Alimentação</h3>
              <Signal icon={<Activity size={18} />} label="Redução de calorias" value={`${context.currentDeficitPct}%`} detail={`${metrics.targets.calories} kcal alvo / ${metrics.tdee} kcal gasto estimado`} />
              <Signal icon={<Utensils size={18} />} label="Proteína alvo" value={`${metrics.targets.proteinG}g`} detail={proteinDetail(context.proteinLast3DaysPct)} />
            </div>
            <div className={styles.signalGroup}>
              <h3>Corpo</h3>
              <Signal icon={<Scale size={18} />} label="Peso" value={latestCheckin ? `${latestCheckin.averageWeightKg} kg` : "sem check-in"} detail={context.weightStableDays ? "estável nas últimas 2 semanas" : "sem platô detectado"} />
              <Signal icon={<LineChart size={18} />} label="Composição" value={bodyComposition.targetBodyFatPct ? `${formatNumber(bodyComposition.targetBodyFatPct)}% BF` : "pendente"} detail={`confiança ${bodyComposition.confidenceLabel}`} />
              <Signal icon={<ShieldAlert size={18} />} label="Confiança TDEE" value={confidenceLabel(tdeeValidation.confidence)} detail={tdeeValidation.message} />
            </div>
            <div className={styles.signalGroup}>
              <h3>Rotina</h3>
              <Signal icon={<Dumbbell size={18} />} label="Performance" value={trainingPerformance.trend === "insufficient" ? "—" : `${trainingPerformance.score}`} detail={trainingCoachDetail(trainingPerformance)} />
              <Signal icon={<Bed size={18} />} label="Sono" value={latestCheckin ? `${latestCheckin.sleep}/10` : "—"} detail={!latestCheckin ? "Registre no check-in" : context.sleepTrend === "down" ? "queda recente" : "sem queda detectada"} />
            </div>
          </div>
        </section>

      {trainingPerformance.alerts.length || insights.length > 1 ? <section className={`${styles.panel} ${styles.insights}`} aria-label="Outras recomendações">
        {trainingPerformance.alerts.slice(0, 1).map((alert) => (
          <article key={`training-${alert.type}`} className={styles.insight} data-tone={alert.type === "drop" || alert.type === "fatigue" ? "warning" : "good"}>
            <div className="flex items-center gap-3">
              <IconTile icon={Dumbbell} colour="red" />
              <div>
                <h3>Performance de carga</h3>
                <p className="text-sm text-text-muted">Treino · pontuação {trainingPerformance.score}</p>
              </div>
            </div>
            <p>{alert.message}</p>
            <p className="text-sm leading-6 text-text-muted">{trainingPerformance.primaryMessage}</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/treinos" className={styles.secondaryButton}>Ver treinos</Link>
              <Link href="/acompanhamento" className={styles.secondaryButton}>Atualizar check-in</Link>
            </div>
          </article>
        ))}
        {insights.slice(1).map((insight) => (
          <article key={insight.trigger} className={styles.insight}>
            <div className="flex items-center gap-3">
              <IconTile {...categoryTile(insight.category)} />
              <div>
                <h3>{insightTitle(insight.trigger)}</h3>
                <p className="text-sm text-text-muted"><span className="capitalize">{categoryLabel(insight.category)}</span> · prioridade {insight.priority}</p>
              </div>
            </div>
            <p>{insight.message}</p>
            <p className="text-sm leading-6 text-text-muted">{insightExplanation(insight.trigger, context)}</p>
            <div className="flex flex-wrap gap-2">
              {insightActions(insight.trigger).map((action) => (
                <Link key={action.href} href={action.href} className={styles.secondaryButton}>{action.label}</Link>
              ))}
            </div>
          </article>
        ))}
      </section> : null}

      <section className={`${styles.panel} ${styles.projections}`} aria-labelledby="coach-projections">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <IconTile icon={LineChart} colour="blue" />
              <h2 id="coach-projections">Projeção da tendência corporal</h2>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-text-muted">
              Projeções usam BF alvo, cintura, massa magra estimada e tendência real. Peso é consequência da composição, não a meta principal.
            </p>
          </div>
          <Link href="/acompanhamento" className={styles.secondaryButton}>
            Atualizar check-in
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        {bodyComposition.scenarios.length ? (
          <>
          <BodyFatRangeBar projection={bodyComposition} />
          <div className={styles.projectionGrid}>
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
              value={confidenceLabel(bodyComposition.confidenceLabel)}
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
          <div className={styles.emptyProjection}>
            <p className="font-semibold">Ainda falta histórico.</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Defina um BF alvo em Metas e registre cintura semanalmente. O ShapeOS vai projetar o físico por massa magra, BF e cintura.
            </p>
            <Link href="/acompanhamento" className={`${styles.tintedButton} mt-4`}>
              Registrar peso e medidas
            </Link>
          </div>
        )}

        {bodySnapshots.length ? (
          <div className={styles.history}>
            <h3>Histórico recente de BF</h3>
            <div className={styles.historyGrid}>
              {bodySnapshots.slice(0, 6).map((snapshot) => (
                <div key={snapshot.id} className={styles.historyEntry}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text-muted">{snapshot.measuredAt.toLocaleDateString("pt-BR")}</span>
                    <span className="text-xs text-text-muted">{snapshotSource(snapshot.source)}</span>
                  </div>
                  <p className="mt-1 font-semibold">{snapshot.bodyFatPct == null ? "BF pendente" : `${formatNumber(snapshot.bodyFatPct)}% BF`}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {formatNumber(snapshot.weightKg)} kg
                    {snapshot.waistCm ? ` · cintura ${formatNumber(snapshot.waistCm)} cm` : ""}
                    {snapshot.leanMassKg ? ` · MM ${formatNumber(snapshot.leanMassKg)} kg` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      </div>
    </AppShell>
  );
}

function Signal({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className={styles.signal}>
      <span className={styles.signalIcon} aria-hidden="true">{icon}</span>
      <div className={styles.signalContent}>
        <div className={styles.signalTitle}><p>{label}</p><strong>{value}</strong></div>
        <p className={styles.signalDetail}>{detail}</p>
      </div>
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

function categoryTile(category: string): { icon: LucideIcon; colour: TileColour } {
  if (category === "weight") return { icon: Scale, colour: "blue" };
  if (category === "sleep") return { icon: Bed, colour: "teal" };
  if (category === "training") return { icon: Dumbbell, colour: "red" };
  if (category === "adherence") return { icon: Activity, colour: "green" };
  return { icon: Utensils, colour: "orange" };
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
  return (
    <div className={styles.projectionStat} data-tone={tone}>
      <div className={styles.projectionLabel}>
        <span aria-hidden="true">{icon}</span>
        <p>{label}</p>
      </div>
      <p className={styles.projectionValue}>{value}</p>
      <p className={styles.projectionDetail}>{detail}</p>
    </div>
  );
}

function BodyFatRangeBar({ projection }: { projection: ReturnType<typeof buildBodyCompositionProjection> }) {
  const { currentBodyFatPct, targetBodyFatPct, progressPct } = projection.bodyFatProgress;
  if (currentBodyFatPct == null || targetBodyFatPct == null) return null;

  return (
    <div className="mt-6 rounded-[14px] bg-surface-tertiary p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Linha de BF</p>
          <p className="mt-1 text-xs text-text-muted">Recalcula automaticamente conforme novos check-ins corporais entram.</p>
        </div>
        <span className="text-xs text-text-muted" title="A confiança aumenta conforme mais check-ins corporais são registrados.">
          confiança {confidenceLabel(projection.confidenceLabel)}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="w-12 text-sm font-semibold tabular-nums">{formatNumber(currentBodyFatPct)}%</span>
        <div className="relative h-1.5 flex-1 rounded-full bg-fill">
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
          <div className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--bg-tertiary)] bg-primary" style={{ left: `${progressPct}%` }} />
        </div>
        <span className="w-12 text-right text-sm font-semibold tabular-nums">{formatNumber(targetBodyFatPct)}%</span>
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

function trainingCoachDetail(performance: ReturnType<typeof analyzeTrainingPerformance>) {
  if (performance.trend === "improving") return `${performance.improvedExercises} subindo`;
  if (performance.trend === "declining") return `${performance.declinedExercises} caindo`;
  if (performance.trend === "stable") return "estável";
  return "poucos dados";
}
