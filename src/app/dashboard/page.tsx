import { redirect } from "next/navigation";
import Link from "next/link";
import { Activity, Apple, ArrowRight, BarChart3, Flame, Plus, Scale, Sparkles, Target, Utensils } from "lucide-react";
import { CoachBubble } from "@/components/coach/coach-bubble";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { ProgressChart } from "@/components/ui/progress-chart";
import { ProgressRing } from "@/components/ui/progress-ring";
import { getCurrentUser } from "@/lib/auth";
import { dailyBriefing, generateCoachInsights, consistencyScore } from "@/lib/coach";
import { buildCoachContext, hasEnoughCoachData } from "@/lib/coach/context";
import { prisma } from "@/lib/prisma";
import { endOfToday, startOfToday } from "@/lib/profile";
import { calculateBmi, calculateBmr, calculateTdee, guidedMacroTargets, nutrientsForGrams, suggestedMicronutrientTargets, sumNutrients, type Goal, type Sex } from "@/lib/nutrition";

const sexMap = { MALE: "male", FEMALE: "female" } as const;
const goalMap = { FAT_LOSS: "fat_loss", MAINTENANCE: "maintenance", MUSCLE_GAIN: "muscle_gain" } as const;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?erro=Sessão não encontrada. Entre novamente.");

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

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
  const activePlan = await prisma.dietPlan.findFirst({
    where: { userId: user.id, isActive: true },
    include: { meals: { include: { items: { include: { food: true } } }, orderBy: { order: "asc" } } },
  });
  const latestBody = await prisma.bodyCompositionSnapshot.findFirst({
    where: { userId: user.id },
    orderBy: { measuredAt: "desc" },
  });

  const sex = sexMap[profile.sex] as Sex;
  const goal = goalMap[profile.goal] as Goal;
  const bmr = calculateBmr({ sex, age: profile.age, heightCm: profile.heightCm, weightKg: profile.weightKg });
  const tdee = calculateTdee(bmr, profile.activityFactor);
  const bmi = calculateBmi(profile.weightKg, profile.heightCm);
  const suggestedMicros = suggestedMicronutrientTargets({ sex, age: profile.age });
  const micronutrientTargets = {
    calciumMg: profile.calciumTargetMg ?? suggestedMicros.calciumMg,
    ironMg: profile.ironTargetMg ?? suggestedMicros.ironMg,
    magnesiumMg: profile.magnesiumTargetMg ?? suggestedMicros.magnesiumMg,
    potassiumMg: profile.potassiumTargetMg ?? suggestedMicros.potassiumMg,
  };
  const targets = guidedMacroTargets({
    weightKg: profile.weightKg,
    tdee,
    goal,
    calorieAdjustment: goal === "fat_loss" ? -(profile.calorieDeficitKcal ?? 400) : undefined,
    proteinPerKg: profile.proteinPerKg ?? 1.8,
    fatPerKg: profile.fatPerKg ?? 0.8,
    fiberG: profile.fiberTargetG ?? 30,
    sodiumMg: profile.sodiumLimitMg ?? 2300,
  });
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
    consumed.calciumMg < micronutrientTargets.calciumMg * 0.5 ? "calcio" : null,
    consumed.ironMg < micronutrientTargets.ironMg * 0.5 ? "ferro" : null,
    consumed.magnesiumMg < micronutrientTargets.magnesiumMg * 0.5 ? "magnesio" : null,
    consumed.potassiumMg < micronutrientTargets.potassiumMg * 0.5 ? "potassio" : null,
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
    averageWeightKg: profile.weightKg,
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

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <MetricTile icon={<Flame size={18} />} label="Consumido" value={`${consumed.kcal} kcal`} detail={`${remainingCalories} kcal restantes`} />
        <MetricTile icon={<Target size={18} />} label="Score" value={`${score}`} detail="consistencia geral" />
        <MetricTile icon={<Scale size={18} />} label="Peso" value={`${profile.weightKg.toLocaleString("pt-BR")} kg`} detail={`IMC ${bmi}`} />
        <MetricTile icon={<Activity size={18} />} label="BF estimado" value={latestBody?.bodyFatPct ? `${latestBody.bodyFatPct.toLocaleString("pt-BR")}%` : "pendente"} detail={latestBody?.leanMassKg ? `MM ${latestBody.leanMassKg.toLocaleString("pt-BR")} kg` : `${profile.heightCm} cm`} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <GlassCard className="p-0">
          <div className="border-b border-white/10 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Plano alimentar</h2>
                <p className="mt-1 text-sm text-zinc-500">{activePlan ? activePlan.name : "Nenhum plano ativo ainda."}</p>
              </div>
              <Link href="/dieta" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15">
                Abrir
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
          <div className="grid gap-3 p-5">
            {activePlan ? activePlan.meals.map((meal) => {
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
              return <MealRow key={meal.id} name={meal.name} items={meal.items.map((item) => `${item.food.name} ${Math.round(item.grams)}g`)} totals={totals} />;
            }) : (
              <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5">
                <p className="text-sm leading-6 text-zinc-400">Gere um plano em Dieta para ver suas refeições reais aqui.</p>
                <Link href="/dieta" className="mt-4 inline-flex rounded-full bg-lime-300 px-4 py-2 text-sm font-semibold text-black">Ir para Dieta</Link>
              </div>
            )}
          </div>
        </GlassCard>

        <div className="grid gap-4">
          <GlassCard>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Progressao</h2>
                <p className="mt-1 text-sm text-zinc-500">Peso medio semanal.</p>
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
                <Link href="/coach" key={insight.trigger} className="block rounded-3xl bg-white/[0.04] p-4 transition hover:bg-white/[0.08]">
                  <p className="text-sm capitalize text-lime-300">{insight.category}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-200">{insight.message}</p>
                </Link>
              )) : <p className="rounded-3xl bg-white/[0.04] p-4 text-sm leading-6 text-zinc-400">Registre alimentos por alguns dias e ao menos dois check-ins para o Coach gerar insights confiaveis.</p>}
            </div>
          </GlassCard>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <ActionPanel icon={<Apple size={18} />} title="Diário alimentar" text="Lance alimentos consumidos hoje e veja meta real contra plano." href="/diario" />
        <ActionPanel icon={<Activity size={18} />} title="Biblioteca" text="Consulte alimentos da TACO, favorite ou bloqueie para a IA." href="/alimentos" />
        <ActionPanel icon={<BarChart3 size={18} />} title="Semana" text="Atualize peso, cintura, sono e aderência para melhorar as projeções." href="/acompanhamento" />
      </div>
      {insights.length ? <CoachBubble message={briefing.recommendation} /> : null}
    </AppShell>
  );
}

function QuickAction({ href, icon, label, primary = false }: { href: string; icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${primary ? "bg-lime-300 text-black hover:bg-lime-200" : "bg-white/10 text-white hover:bg-white/15"}`}
    >
      {icon}
      {label}
    </Link>
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

function MealRow({ name, items, totals }: { name: string; items: string[]; totals: { kcal: number; protein: number; carbs: number; fat: number } }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-4 transition hover:border-lime-300/30 hover:bg-white/[0.04]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{name}</p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-500">{items.join(" + ")}</p>
        </div>
        <div className="text-right text-sm text-zinc-300">
          <p className="text-base font-semibold">{Math.round(totals.kcal)} kcal</p>
          <p className="text-zinc-500">P {Math.round(totals.protein)}g C {Math.round(totals.carbs)}g G {Math.round(totals.fat)}g</p>
        </div>
      </div>
    </div>
  );
}

function ActionPanel({ icon, title, text, href }: { icon: React.ReactNode; title: string; text: string; href: string }) {
  return (
    <Link href={href} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 transition hover:border-lime-300/30 hover:bg-white/[0.07]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lime-300/15 text-lime-300">{icon}</div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-500">{text}</p>
    </Link>
  );
}

function percent(value: number, target: number) {
  if (!target) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}
