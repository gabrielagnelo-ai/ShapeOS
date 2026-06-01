import { redirect } from "next/navigation";
import { Activity, Apple, ArrowRight, BarChart3, CalendarDays, Droplets, Dumbbell, Flame, FlaskConical, Gauge, Plus, Scale, Sparkles, Target, Utensils } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { ProgressChart } from "@/components/ui/progress-chart";
import { ProgressRing } from "@/components/ui/progress-ring";
import { WaterReminder } from "@/components/water/water-reminder";
import { getCurrentUser } from "@/lib/auth";
import { bodyStateFromLatestSnapshot, recalculateBodyCompositionSnapshots } from "@/lib/body-composition";
import { buildBodyCompositionProjection } from "@/lib/bodyCompositionEngine";
import { dailyBriefing, generateCoachInsights, consistencyScore } from "@/lib/coach";
import { buildCoachContext, hasEnoughCoachData } from "@/lib/coach/context";
import { mealOrder, normalizeMealName } from "@/lib/meals";
import { prisma } from "@/lib/prisma";
import { calendarPeriods, foodPeriodSummary, waterPeriodSummary } from "@/lib/period-averages";
import { endOfToday, startOfToday } from "@/lib/profile";
import { calculateBmi, calculateBmr, calculateTdee, guidedMacroTargets, nutrientsForGrams, suggestedMicronutrientTargets, sumNutrients, type Goal, type Sex } from "@/lib/nutrition";
import { effectiveTdee, validateTdeeTrend } from "@/lib/tdee";
import { analyzeTrainingPerformance, trainingLogsFromPlan } from "@/lib/training-performance";
import { waterPreferenceLabel, waterTargetMl } from "@/lib/water";
import { addWaterLogAction } from "./actions";

const sexMap = { MALE: "male", FEMALE: "female" } as const;
const goalMap = { FAT_LOSS: "fat_loss", MAINTENANCE: "maintenance", MUSCLE_GAIN: "muscle_gain" } as const;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?erro=Sessão não encontrada. Entre novamente.");

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

  const periods = calendarPeriods();
  const todayLog = await prisma.foodLog.findFirst({
    where: { userId: user.id, date: { gte: startOfToday(), lte: endOfToday() } },
    include: { items: { include: { food: true } } },
  });
  const weeklyCheckins = await prisma.weeklyCheckin.findMany({
    where: { userId: user.id },
    orderBy: { weekStart: "asc" },
    take: 8,
  });
  const recentFoodLogs = await prisma.foodLog.findMany({
    where: { userId: user.id },
    include: { items: { include: { food: true } } },
    orderBy: { date: "desc" },
    take: 7,
  });
  const periodFoodLogs = await prisma.foodLog.findMany({
    where: { userId: user.id, date: { gte: periods.semester.start, lt: periods.semester.end } },
    include: { items: { include: { food: true } } },
    orderBy: { date: "desc" },
  });
  const activePlan = await prisma.dietPlan.findFirst({
    where: { userId: user.id, isActive: true },
    include: { meals: { include: { items: { include: { food: true } } }, orderBy: { order: "asc" } } },
  });
  const activePlanMeals = activePlan ? sortMeals(activePlan.meals) : [];
  const rawBodySnapshots = await prisma.bodyCompositionSnapshot.findMany({
    where: { userId: user.id },
    orderBy: { measuredAt: "desc" },
    take: 12,
  });
  const waterLogs = await prisma.waterLog.findMany({
    where: { userId: user.id, date: { gte: periods.semester.start, lt: periods.semester.end } },
    select: { date: true, amountMl: true },
  });
  const physicalActivities = await prisma.physicalActivityLog.findMany({
    where: { userId: user.id, date: { gte: startOfToday(), lte: endOfToday() } },
  });
  const trainingPlan = await prisma.trainingPlan.findFirst({
    where: { userId: user.id, isActive: true },
    include: {
      days: {
        include: {
          exercises: {
            include: { logs: { where: { userId: user.id }, orderBy: { date: "desc" }, take: 4 } },
          },
        },
      },
    },
  });

  const sex = sexMap[profile.sex] as Sex;
  const goal = goalMap[profile.goal] as Goal;
  const bodySnapshots = recalculateBodyCompositionSnapshots(rawBodySnapshots, { sex, heightCm: profile.heightCm });
  const latestBody = bodySnapshots[0];
  const currentBody = bodyStateFromLatestSnapshot(profile, bodySnapshots);
  const bmr = calculateBmr({ sex, age: profile.age, heightCm: profile.heightCm, weightKg: currentBody.weightKg });
  const tdee = calculateTdee(bmr, profile.activityFactor) + profile.tdeeAdjustmentKcal;
  const bmi = calculateBmi(currentBody.weightKg, profile.heightCm);
  const suggestedMicros = suggestedMicronutrientTargets({ sex, age: profile.age });
  const micronutrientTargets = {
    calciumMg: profile.calciumTargetMg ?? suggestedMicros.calciumMg,
    ironMg: profile.ironTargetMg ?? suggestedMicros.ironMg,
    magnesiumMg: profile.magnesiumTargetMg ?? suggestedMicros.magnesiumMg,
    potassiumMg: profile.potassiumTargetMg ?? suggestedMicros.potassiumMg,
  };
  const targets = guidedMacroTargets({
    weightKg: currentBody.weightKg,
    tdee,
    goal,
    calorieAdjustment: goal === "fat_loss" ? -(profile.calorieDeficitKcal ?? 400) : undefined,
    proteinPerKg: profile.proteinPerKg ?? 1.8,
    fatPerKg: profile.fatPerKg ?? 0.8,
    fiberG: profile.fiberTargetG ?? 30,
    sodiumMg: profile.sodiumLimitMg ?? 2300,
  });
  const waterTarget = waterTargetMl(currentBody.weightKg, profile.waterPreference);
  const waterConsumed = waterLogs.filter((log) => log.date >= startOfToday() && log.date <= endOfToday()).reduce((total, log) => total + log.amountMl, 0);
  const waterPct = percent(waterConsumed, waterTarget);
  const periodFood = periodFoodLogs.map((log) => ({
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
  }));
  const foodMonth = foodPeriodSummary(periodFood, periods.month);
  const waterMonth = waterPeriodSummary(waterLogs, periods.month);
  const waterQuarter = waterPeriodSummary(waterLogs, periods.quarter);
  const waterSemester = waterPeriodSummary(waterLogs, periods.semester);
  const tdeeResult = effectiveTdee({
    bmr,
    activityFactor: profile.activityFactor,
    adjustmentKcal: profile.tdeeAdjustmentKcal,
    mode: profile.tdeeCalculationMode,
    activities: physicalActivities,
  });
  const activityKcal = tdeeResult.activityKcal;
  const consumed = sumNutrients(todayLog?.items.map((item) => ({
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
  })) ?? []);
  const lowMicronutrients = [
    consumed.calciumMg < micronutrientTargets.calciumMg * 0.5 ? "cálcio" : null,
    consumed.ironMg < micronutrientTargets.ironMg * 0.5 ? "ferro" : null,
    consumed.magnesiumMg < micronutrientTargets.magnesiumMg * 0.5 ? "magnésio" : null,
    consumed.potassiumMg < micronutrientTargets.potassiumMg * 0.5 ? "potássio" : null,
  ].filter(Boolean) as string[];

  const coachContext = buildCoachContext({
    goal,
    tdee,
    targetCalories: targets.calories,
    proteinTargetG: targets.proteinG,
    foodLogs: recentFoodLogs,
    checkins: weeklyCheckins,
    lowMicronutrients: todayLog?.items.length ? lowMicronutrients : [],
  });
  const insights = hasEnoughCoachData(coachContext) ? generateCoachInsights(coachContext) : [];
  const dayPct = Math.min(100, Math.round((consumed.kcal / targets.calories) * 100));
  const remainingCalories = Math.max(0, Math.round(targets.calories - consumed.kcal));
  const briefing = dailyBriefing({
    averageWeightKg: currentBody.weightKg,
    adherencePct: 88,
    macroCompletionPct: dayPct,
    sleepScore: 7,
    insights,
  });
  const score = consistencyScore({
    dietAdherencePct: 88,
    checkinsDone: weeklyCheckins.length ? 1 : 0,
    checkinsTarget: 1,
    proteinHitDays: recentFoodLogs.filter((log) => log.items.length).length,
    sleepScore: weeklyCheckins.at(-1)?.sleep ?? 7,
    trainingDone: weeklyCheckins.at(-1)?.trainingDone ? 3 : 0,
    trainingTarget: 4,
  });
  const macroPcts = {
    protein: percent(consumed.proteinG, targets.proteinG),
    carbs: percent(consumed.carbsG, targets.carbsG),
    fat: percent(consumed.fatG, targets.fatG),
  };
  const averageIntakeKcal = Math.round(foodMonth.average.kcal);
  const trendValidation = validateTdeeTrend({
    tdee,
    averageIntakeKcal,
    checkins: weeklyCheckins,
  });
  const trainingPerformance = analyzeTrainingPerformance(trainingPlan ? trainingLogsFromPlan(trainingPlan) : []);
  const bodyComposition = buildBodyCompositionProjection({
    currentWeightKg: currentBody.weightKg,
    currentWaistCm: currentBody.waistCm,
    currentBodyFatPct: latestBody?.bodyFatPct,
    targetWaistCm: profile.targetWaistCm,
    targetBodyFatPct: profile.targetBodyFatPct,
    targetDate: profile.targetDate,
    checkins: weeklyCheckins,
    snapshots: bodySnapshots,
    proteinHitRate: proteinHitRate(foodMonth.dayTotals, targets.proteinG),
    deficitPct: goal === "fat_loss" && tdee ? Math.round(((tdee - targets.calories) / tdee) * 100) : 0,
  });
  const activePlanTotals = activePlan
    ? activePlanMeals.flatMap((meal) => meal.items).reduce(
        (acc, item) => {
          const nutrients = nutrientsForGrams({
            name: item.food.name,
            kcalPer100g: item.food.kcalPer100g,
            proteinPer100g: item.food.proteinPer100g,
            carbsPer100g: item.food.carbsPer100g,
            fatPer100g: item.food.fatPer100g,
            fiberPer100g: item.food.fiberPer100g ?? 0,
            sodiumPer100g: item.food.sodiumPer100g ?? 0,
          }, item.grams);

          return {
            kcal: acc.kcal + nutrients.kcal,
            protein: acc.protein + nutrients.proteinG,
            carbs: acc.carbs + nutrients.carbsG,
            fat: acc.fat + nutrients.fatG,
          };
        },
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      )
    : null;
  const nextAction = !activePlan
    ? { href: "/dieta", title: "Gerar plano alimentar", text: "Crie sua primeira dieta com IA ou registre a dieta do nutricionista.", cta: "Abrir dieta" }
    : !todayLog?.items.length
      ? { href: "/diario", title: "Registrar primeira refeição", text: "Lance o que você comeu hoje para o ShapeOS comparar real vs meta.", cta: "Registrar alimento" }
      : !weeklyCheckins.length
        ? { href: "/acompanhamento", title: "Fazer check-in semanal", text: "Peso, cintura, sono e treino melhoram as projeções do Coach.", cta: "Fazer check-in" }
        : insights.length
          ? { href: "/coach", title: "Ver recomendação do Coach", text: insights[0].message, cta: "Abrir Coach" }
          : { href: "/diario", title: "Manter consistência", text: "Continue registrando refeições para manter o acompanhamento confiável.", cta: "Registrar hoje" };

  return (
    <AppShell>
      <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(184,255,0,.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,.09),rgba(255,255,255,.03))] p-5 shadow-2xl shadow-black/40 md:p-7">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/60 to-transparent" />
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="flex min-h-72 flex-col justify-between">
            <div>
              <p className="text-sm font-medium text-lime-300">Hoje, {user.name.split(" ")[0]}</p>
              <h1 className="mt-3 max-w-3xl text-5xl font-semibold tracking-tight text-white md:text-6xl">
                {remainingCalories} kcal restantes
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-300">{briefing.recommendation}</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              <QuickAction href="/diario" icon={<Plus size={16} />} label="Registrar alimento" primary />
              <QuickAction href="/dieta" icon={<Utensils size={16} />} label="Editar dieta" />
              <QuickAction href="/acompanhamento" icon={<BarChart3 size={16} />} label="Check-in" />
              <QuickAction href="/coach" icon={<Sparkles size={16} />} label="Coach" />
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-zinc-500">Progresso do dia</p>
                <p className="mt-1 text-2xl font-semibold">{consumed.kcal} / {targets.calories}</p>
              </div>
              <ProgressRing value={dayPct} label="dia" />
            </div>
            <div className="mt-5 grid gap-3">
              <MacroBar label="Proteína" consumed={Math.round(consumed.proteinG)} target={targets.proteinG} pct={macroPcts.protein} color="#7dd3fc" />
              <MacroBar label="Carbo" consumed={Math.round(consumed.carbsG)} target={targets.carbsG} pct={macroPcts.carbs} color="#b8ff00" />
              <MacroBar label="Gordura" consumed={Math.round(consumed.fatG)} target={targets.fatG} pct={macroPcts.fat} color="#fbbf24" />
            </div>
          </div>
        </div>
      </section>

      <a href={nextAction.href} className="mt-5 flex flex-col justify-between gap-4 rounded-[28px] border border-lime-300/25 bg-lime-300/10 p-5 transition hover:bg-lime-300/15 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-semibold text-lime-200">Próxima ação</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{nextAction.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{nextAction.text}</p>
        </div>
        <span className="inline-flex items-center justify-center gap-2 rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-black">
          {nextAction.cta}
          <ArrowRight size={16} />
        </span>
      </a>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        <MetricTile icon={<Flame size={18} />} label="Consumido" value={`${consumed.kcal} kcal`} detail={`${remainingCalories} kcal restantes`} />
        <MetricTile icon={<Target size={18} />} label="Score" value={`${score}`} detail="dieta, proteína, sono, treino e check-ins" />
        <MetricTile icon={<Scale size={18} />} label="Peso" value={`${currentBody.weightKg.toLocaleString("pt-BR")} kg`} detail={`IMC ${bmi}`} />
        <MetricTile icon={<Activity size={18} />} label="BF estimado" value={latestBody?.bodyFatPct ? `${latestBody.bodyFatPct.toLocaleString("pt-BR")}%` : "pendente"} detail={latestBody?.leanMassKg ? `MM ${latestBody.leanMassKg.toLocaleString("pt-BR")} kg` : `${profile.heightCm} cm`} />
        <MetricTile icon={<Activity size={18} />} label="Atividade" value={`${Math.round(activityKcal)} kcal`} detail={`${tdeeResult.ignoredActivityKcal} kcal ignoradas`} />
        <MetricTile icon={<Gauge size={18} />} label="Conf. TDEE" value={confidenceLabel(trendValidation.confidence)} detail={trendValidation.message} />
        <MetricTile icon={<Droplets size={18} />} label="Água" value={`${formatLiters(waterConsumed)} / ${formatLiters(waterTarget)}`} detail={`média mês ${formatLiters(waterMonth.averageMl)} em ${waterMonth.registeredDays} dias`} />
        <MetricTile icon={<Dumbbell size={18} />} label="Performance" value={`${trainingPerformance.score}`} detail={trainingDashboardDetail(trainingPerformance)} />
      </div>

      <GlassCard className="mt-5 border-sky-300/20 bg-sky-300/[0.06]">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky-300/15 text-sky-200">
              <Droplets size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">Hidratação</h2>
                <span className="rounded-full bg-sky-300/15 px-3 py-1 text-xs font-semibold text-sky-100">{waterPct}%</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Meta diária: {formatLiters(waterTarget)} ({waterPreferenceLabel(profile.waterPreference).toLowerCase()}). Hoje: {formatLiters(waterConsumed)}.
                Média de {periods.month.label}: {formatLiters(waterMonth.averageMl)} em {waterMonth.registeredDays} dias lançados.
              </p>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-sky-300" style={{ width: `${waterPct}%` }} />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <MiniStat label="Mês" value={formatLiters(waterMonth.averageMl)} detail={`${waterMonth.registeredDays} dias`} />
                <MiniStat label="Trimestre" value={formatLiters(waterQuarter.averageMl)} detail={`${waterQuarter.registeredDays} dias`} />
                <MiniStat label="Semestre" value={formatLiters(waterSemester.averageMl)} detail={`${waterSemester.registeredDays} dias`} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            {[250, 500, 750].map((amount) => (
              <form key={amount} action={addWaterLogAction}>
                <input type="hidden" name="amountMl" value={amount} />
                <button className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/15">
                  +{amount} ml
                </button>
              </form>
            ))}
            <WaterReminder targetMl={waterTarget} />
          </div>
        </div>
      </GlassCard>

      <GlassCard className="mt-5 border-lime-300/25 bg-[radial-gradient(circle_at_0%_0%,rgba(184,255,0,.10),transparent_34%),linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.03))]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime-300/15 text-lime-300">
                <CalendarDays size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-semibold tracking-tight">Composição corporal</h2>
                  <span className="rounded-full bg-lime-300/15 px-3 py-1 text-xs font-semibold text-lime-100" title="A confiança aumenta conforme mais check-ins corporais são registrados.">confiança {bodyComposition.confidenceLabel}</span>
                </div>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">
                  {bodyComposition.hasGoal
                    ? compositionSummary(bodyComposition)
                    : "Defina BF alvo e cintura para o ShapeOS projetar como seu físico pode ficar, não apenas quanto você pesaria."}
                </p>
              </div>
            </div>
            <a href="/configuracoes" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-lime-300 px-4 py-2 text-sm font-semibold text-black transition hover:bg-lime-200">
              Ajustar meta
              <ArrowRight size={15} />
            </a>
          </div>

          <BodyFatRangeBar projection={bodyComposition} />

          <div className="grid gap-3 lg:grid-cols-3">
            <CompositionMetric label="Massa magra estimada" value={bodyComposition.currentLeanMassKg ? `${formatNumber(bodyComposition.currentLeanMassKg)} kg` : "pendente"} detail="referência principal para projetar o físico" featured />
            <CompositionMetric label="Gordura atual" value={bodyComposition.currentFatMassKg ? `${formatNumber(bodyComposition.currentFatMassKg)} kg` : "pendente"} detail="estimada pelo BF atual" featured />
            <CompositionMetric label="Gordura a perder" value={bodyComposition.fatMassToLoseKg ? `${formatNumber(bodyComposition.fatMassToLoseKg)} kg` : "pendente"} detail="até o BF alvo mantendo massa magra" featured />
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <CompositionMetric label="Gordura alvo" value={bodyComposition.targetFatMassKg ? `${formatNumber(bodyComposition.targetFatMassKg)} kg` : "pendente"} detail="massa gorda no BF alvo" />
            <CompositionMetric label="Faixa provável" value={bodyComposition.probableWeightRangeKg ? `${formatNumber(bodyComposition.probableWeightRangeKg.minKg)}-${formatNumber(bodyComposition.probableWeightRangeKg.maxKg)} kg` : "pendente"} detail="variação de água e glicogênio" />
            <CompositionMetric label="BF alvo" value={bodyComposition.targetBodyFatPct ? `${formatNumber(bodyComposition.targetBodyFatPct)}%` : "defina"} detail="meta visual principal" />
          </div>
        </div>
      </GlassCard>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <GlassCard className="overflow-hidden p-0">
          <div className="relative border-b border-white/10 p-5 md:p-6">
            <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/50 to-transparent" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold">Plano alimentar</h2>
                  {activePlan ? <span className="rounded-full bg-lime-300/12 px-3 py-1 text-xs font-medium text-lime-200">ativo</span> : null}
                </div>
                <p className="mt-2 text-sm text-zinc-500">{activePlan ? activePlan.name : "Nenhum plano ativo ainda."}</p>
              </div>
              <a href="/dieta" className="inline-flex items-center gap-2 rounded-full bg-lime-300 px-4 py-2 text-sm font-semibold text-black transition hover:bg-lime-200">
                Abrir
                <ArrowRight size={15} />
              </a>
            </div>
            {activePlanTotals ? (
              <div className="mt-5 grid gap-2 sm:grid-cols-4">
                <PlanTotal label="Kcal" value={`${Math.round(activePlanTotals.kcal)}`} />
                <PlanTotal label="Proteína" value={`${Math.round(activePlanTotals.protein)}g`} />
                <PlanTotal label="Carbo" value={`${Math.round(activePlanTotals.carbs)}g`} />
                <PlanTotal label="Gordura" value={`${Math.round(activePlanTotals.fat)}g`} />
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 p-4 md:p-5">
            {activePlan ? activePlanMeals.map((meal) => {
              const totals = meal.items.reduce(
                (acc, item) => {
                  const n = nutrientsForGrams({
                    name: item.food.name,
                    kcalPer100g: item.food.kcalPer100g,
                    proteinPer100g: item.food.proteinPer100g,
                    carbsPer100g: item.food.carbsPer100g,
                    fatPer100g: item.food.fatPer100g,
                    fiberPer100g: item.food.fiberPer100g ?? 0,
                    sodiumPer100g: item.food.sodiumPer100g ?? 0,
                  }, item.grams);
                  return {
                    kcal: acc.kcal + n.kcal,
                    protein: acc.protein + n.proteinG,
                    carbs: acc.carbs + n.carbsG,
                    fat: acc.fat + n.fatG,
                  };
                },
                { kcal: 0, protein: 0, carbs: 0, fat: 0 },
              );
              return <MealRow key={meal.id} name={normalizeMealName(meal.name)} items={meal.items.map((item) => ({ name: item.food.name, grams: item.grams }))} totals={totals} />;
            }) : (
              <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5">
                <p className="text-sm leading-6 text-zinc-400">Gere um plano em Dieta para ver suas refeições reais aqui.</p>
                <a href="/dieta" className="mt-4 inline-flex rounded-full bg-lime-300 px-4 py-2 text-sm font-semibold text-black">Ir para Dieta</a>
              </div>
            )}
          </div>
        </GlassCard>

        <div className="grid gap-4">
          <GlassCard>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Progressão</h2>
                <p className="mt-1 text-sm text-zinc-500">Peso médio semanal.</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-zinc-400">{weeklyCheckins.length}</span>
            </div>
            <ProgressChart
              points={weeklyCheckins.map((checkin) => ({
                label: checkin.weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
                value: checkin.averageWeightKg,
              }))}
            />
          </GlassCard>

          <GlassCard>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Coach</h2>
                <p className="mt-1 text-sm text-zinc-500">{insights.length ? `${insights.length} sinais ativos` : "sem alertas"}</p>
              </div>
              <Sparkles className="text-lime-300" />
            </div>
            <div className="mt-5 space-y-3">
              {insights.length ? insights.slice(0, 3).map((insight) => (
                <a href="/coach" key={insight.trigger} className="block rounded-3xl bg-white/[0.04] p-4 transition hover:bg-white/[0.08]">
                  <p className="text-sm text-lime-300">{coachCategoryLabel(insight.category)}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-200">{insight.message}</p>
                </a>
              )) : <p className="rounded-3xl bg-white/[0.04] p-4 text-sm leading-6 text-zinc-400">Registre alimentos por alguns dias e ao menos dois check-ins para o Coach gerar insights confiáveis.</p>}
            </div>
          </GlassCard>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <ActionPanel icon={<Apple size={18} />} title="Diário alimentar" text="Lance alimentos consumidos hoje e veja meta real contra plano." href="/diario" />
        <ActionPanel icon={<Activity size={18} />} title="Atividade física" text="Registre treino e cardio para conferir seu TDEE do dia." href="/atividades" />
        <ActionPanel icon={<Dumbbell size={18} />} title="Treinos" text="Registre carga, reps e RPE para o ShapeOS avaliar progressão." href="/treinos" />
        <ActionPanel icon={<BarChart3 size={18} />} title="Semana" text="Atualize peso, cintura, sono e aderência para melhorar as projeções." href="/acompanhamento" />
        <ActionPanel icon={<FlaskConical size={18} />} title="Suplementos" text="Acompanhe creatina, beta-alanina, dose acumulada e aderência." href="/suplementos" />
      </div>
    </AppShell>
  );
}

function QuickAction({ href, icon, label, primary = false }: { href: string; icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${primary ? "bg-lime-300 text-black hover:bg-lime-200" : "bg-white/10 text-white hover:bg-white/15"}`}
    >
      {icon}
      {label}
    </a>
  );
}

function MacroBar({ label, consumed, target, pct, color }: { label: string; consumed: number; target: number; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="font-medium text-zinc-100">{consumed}/{target}g</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function MetricTile({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <GlassCard className="min-h-32">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-lime-300">{icon}</div>
      </div>
      <p className="mt-4 text-sm text-zinc-500">{detail}</p>
    </GlassCard>
  );
}

function PlanTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-100">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function MealRow({
  name,
  items,
  totals,
}: {
  name: string;
  items: { name: string; grams: number }[];
  totals: { kcal: number; protein: number; carbs: number; fat: number };
}) {
  const hasItems = items.length > 0;

  return (
    <div className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-[#111]/80 p-4 transition hover:border-lime-300/30 hover:bg-[#151515]">
      <div className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-lime-300/80 opacity-70 transition group-hover:opacity-100" />
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="min-w-0 pl-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold tracking-tight">{name}</p>
            {!hasItems ? <span className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-zinc-500">sem itens</span> : null}
          </div>

          {hasItems ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {items.map((item) => (
                <span key={`${item.name}-${item.grams}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-300">
                  {cleanFoodName(item.name)} <span className="text-zinc-500">{Math.round(item.grams)}g</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-zinc-500">Adicione alimentos nesta refeição para completar a distribuição do dia.</p>
          )}
        </div>

        <div className="min-w-44 rounded-3xl bg-black/30 p-3 text-right">
          <p className="text-2xl font-semibold tracking-tight">{Math.round(totals.kcal)}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">kcal</p>
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
            <MacroPill label="P" value={Math.round(totals.protein)} />
            <MacroPill label="C" value={Math.round(totals.carbs)} />
            <MacroPill label="G" value={Math.round(totals.fat)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MacroPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-2 py-2">
      <p className="text-[10px] font-semibold text-lime-300">{label}</p>
      <p className="mt-0.5 text-xs text-zinc-300">{value}g</p>
    </div>
  );
}

function formatLiters(valueMl: number) {
  return `${(valueMl / 1000).toFixed(1).replace(".", ",")} L`;
}

function cleanFoodName(name: string) {
  return name
    .replace(/,\s*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\bcozido\/10minutos\b/gi, "cozido")
    .trim();
}

function coachCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    nutrition: "Nutrição",
    weight: "Peso",
    sleep: "Sono",
    adherence: "Aderência",
    training: "Treino",
  };

  return labels[category] ?? category;
}

function sortMeals<T extends { name: string; order: number }>(meals: T[]) {
  return [...meals].sort((a, b) => mealOrder(a.name) - mealOrder(b.name) || a.order - b.order);
}

function ActionPanel({ icon, title, text, href }: { icon: React.ReactNode; title: string; text: string; href: string }) {
  return (
    <a href={href} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 transition hover:border-lime-300/30 hover:bg-white/[0.07]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lime-300/15 text-lime-300">{icon}</div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-500">{text}</p>
    </a>
  );
}

function percent(value: number, target: number) {
  if (!target) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

function confidenceLabel(value: string) {
  const labels: Record<string, string> = {
    HIGH: "alta",
    MEDIUM: "media",
    LOW: "baixa",
  };

  return labels[value] ?? "media";
}

function CompositionMetric({ label, value, detail, featured = false }: { label: string; value: string; detail: string; featured?: boolean }) {
  return (
    <div className={`rounded-3xl border px-4 py-4 ${featured ? "border-lime-300/20 bg-lime-300/[0.075]" : "border-white/10 bg-black/20"}`}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className={`${featured ? "mt-2 text-3xl" : "mt-1 text-xl"} font-semibold tracking-tight text-zinc-100`}>{value}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}

function BodyFatRangeBar({ projection }: { projection: ReturnType<typeof buildBodyCompositionProjection> }) {
  const { currentBodyFatPct, targetBodyFatPct, progressPct } = projection.bodyFatProgress;
  if (currentBodyFatPct == null || targetBodyFatPct == null) return null;

  return (
    <div className="rounded-[28px] border border-white/10 bg-black/25 p-4" title="A barra recalcula automaticamente conforme novos check-ins corporais são registrados.">
      <div className="mb-3 flex items-center justify-between gap-4 text-sm font-semibold text-zinc-400">
        <span className="rounded-full bg-white/10 px-3 py-1">{formatNumber(currentBodyFatPct)}% atual</span>
        <span className="rounded-full bg-lime-300/15 px-3 py-1 text-lime-100">{formatNumber(targetBodyFatPct)}% alvo</span>
      </div>
      <div className="relative h-3 rounded-full bg-white/10">
        <div className="absolute inset-y-0 left-0 rounded-full bg-lime-300/70" style={{ width: `${progressPct}%` }} />
        <div className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-lime-300 shadow-[0_0_22px_rgba(184,255,0,.45)]" style={{ left: `${progressPct}%` }} />
      </div>
    </div>
  );
}

function compositionSummary(projection: ReturnType<typeof buildBodyCompositionProjection>) {
  const realistic = projection.scenarios.find((scenario) => scenario.key === "realistic");
  if (projection.recomposition.detected) return "Seu físico está mudando mesmo sem grande queda de peso. Cintura e BF têm prioridade sobre o peso isolado.";
  if (realistic) {
    const fatLoss = projection.fatMassToLoseKg ? `reduzir cerca de ${formatNumber(projection.fatMassToLoseKg)} kg de gordura` : "reduzir gordura";
    const range = projection.probableWeightRangeKg ? `Faixa provável: ${formatNumber(projection.probableWeightRangeKg.minKg)}-${formatNumber(projection.probableWeightRangeKg.maxKg)} kg.` : "";
    return `Para chegar em ${formatNumber(projection.targetBodyFatPct ?? realistic.bodyFatPct)}% BF, o foco é ${fatLoss} mantendo massa magra. ${range}`.trim();
  }
  return projection.primaryMessage;
}

function proteinHitRate(days: Array<{ totals: { proteinG: number } }>, targetProteinG: number) {
  if (!days.length || !targetProteinG) return null;
  const hitDays = days.filter((day) => day.totals.proteinG >= targetProteinG * 0.9).length;
  return hitDays / days.length;
}

function formatNumber(value: number) {
  return (Math.round(value * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function trainingDashboardDetail(performance: ReturnType<typeof analyzeTrainingPerformance>) {
  if (performance.trend === "improving") return `${performance.improvedExercises} exercicio(s) em progressao`;
  if (performance.trend === "declining") return `${performance.declinedExercises} exercicio(s) em queda`;
  if (performance.trend === "stable") return `${performance.comparableExercises} exercicio(s) comparados`;
  return "registre carga e reps";
}
