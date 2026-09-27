import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { DiaryFoodForm, DiaryItemEditor } from "@/components/food/diary-forms";
import { SubmitButton } from "@/components/ui/submit-button";
import { diaryDate } from "@/lib/diary-input";
import Link from "next/link";
import { Check, CheckCircle2, Pill, RotateCcw, Trash2, Utensils } from "lucide-react";
import { appDateInputValue, endOfTodayInAppTimeZone } from "@/lib/date-time";
import { formatRecipePortions, groupDietMealItems } from "@/lib/diet-meal-display";
import { prisma } from "@/lib/prisma";
import { computeCurrentProfileMetrics, requireUserProfile, startOfToday } from "@/lib/profile";
import { macroProgress, sumNutrients } from "@/lib/nutrition";
import { sumSupplementMicronutrients, supplementDoseUnit, supplementNutrientDefinitions } from "@/lib/supplements";
import { registerDietMealAction, unregisterDietMealAction } from "./actions";
import { deleteSupplementLogAction, logSupplementDoseAction } from "@/app/suplementos/actions";

export default async function DiarioPage({ searchParams }: { searchParams: Promise<{ data?: string; status?: string }> }) {
  const { data, status } = await searchParams;
  const realToday = appDateInputValue();
  const selectedDate = data ? diaryDate(data) : startOfToday();
  const invalidDate = Boolean(data && !selectedDate);
  const { user, profile } = await requireUserProfile();
  const { metrics } = await computeCurrentProfileMetrics(user.id, profile);
  const todayStart = selectedDate ?? startOfToday();
  const todayEnd = endOfTodayInAppTimeZone(todayStart);
  const today = appDateInputValue(todayStart);
  const isToday = today === realToday;
  const yesterday = appDateInputValue(new Date(startOfToday().getTime() - 12 * 60 * 60 * 1000));
  const [foods, log, multivitamins, activePlan] = await Promise.all([
    prisma.food.findMany({
      where: { OR: [{ createdByUserId: null }, { createdByUserId: user.id }] },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, kcalPer100g: true },
    }),
    prisma.foodLog.findFirst({
      where: { userId: user.id, date: { gte: todayStart, lte: todayEnd } },
      include: { items: { include: { food: true }, orderBy: { id: "desc" } } },
    }),
    prisma.supplementPlan.findMany({
      where: { userId: user.id, isActive: true, type: "MULTIVITAMIN" },
      include: { logs: { where: { date: { gte: todayStart, lte: todayEnd } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.dietPlan.findFirst({
      where: { userId: user.id, isActive: true },
      include: {
        meals: {
          orderBy: { order: "asc" },
          include: { items: { include: { food: true, recipe: { select: { id: true, name: true } } }, orderBy: { id: "asc" } } },
        },
      },
    }),
  ]);

  const foodConsumed = sumNutrients(
    log?.items.map((item) => ({
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
    })) ?? [],
  );
  const supplementConsumed = sumSupplementMicronutrients(multivitamins);
  const consumed = {
    ...foodConsumed,
    calciumMg: foodConsumed.calciumMg + supplementConsumed.calciumMg,
    ironMg: foodConsumed.ironMg + supplementConsumed.ironMg,
    magnesiumMg: foodConsumed.magnesiumMg + supplementConsumed.magnesiumMg,
    potassiumMg: foodConsumed.potassiumMg + supplementConsumed.potassiumMg,
    zincMg: foodConsumed.zincMg + supplementConsumed.zincMg,
    vitaminCMg: foodConsumed.vitaminCMg + supplementConsumed.vitaminCMg,
    vitaminDMcg: foodConsumed.vitaminDMcg + supplementConsumed.vitaminDMcg,
    vitaminB12Mcg: foodConsumed.vitaminB12Mcg + supplementConsumed.vitaminB12Mcg,
  };
  const progress = macroProgress(consumed, metrics.targets);
  const bars = [
    ["Calorias", progress.calories],
    ["Proteína", progress.protein],
    ["Carboidrato", progress.carbs],
    ["Gordura", progress.fat],
    ["Fibra", progress.fiber ?? 0],
    ["Sódio", progress.sodium ?? 0],
  ];
  const microBars = [
    ["Cálcio", "calciumMg", metrics.micronutrientTargets.calciumMg, "mg"],
    ["Ferro", "ironMg", metrics.micronutrientTargets.ironMg, "mg"],
    ["Magnésio", "magnesiumMg", metrics.micronutrientTargets.magnesiumMg, "mg"],
    ["Potássio", "potassiumMg", metrics.micronutrientTargets.potassiumMg, "mg"],
    ["Zinco", "zincMg", metrics.micronutrientTargets.zincMg, "mg"],
    ["Vitamina C", "vitaminCMg", metrics.micronutrientTargets.vitaminCMg, "mg"],
    ["Vitamina D", "vitaminDMcg", metrics.micronutrientTargets.vitaminDMcg, "mcg"],
    ["Vitamina B12", "vitaminB12Mcg", metrics.micronutrientTargets.vitaminB12Mcg, "mcg"],
  ] as const;
  const hasSupplementDose = multivitamins.some((plan) => plan.logs.length);
  const supplementDoseCount = multivitamins.reduce(
    (total, plan) => total + plan.logs.reduce((sum, dose) => sum + dose.doseG, 0),
    0,
  );
  const hasMicronutrientData = Boolean(log?.items.length || hasSupplementDose);
  const foodTrackedKeys = microBars.map(([, key]) => key as string);
  const supplementOnlyNutrients = supplementNutrientDefinitions.filter(({ key }) => !foodTrackedKeys.includes(key));

  return (
    <AppShell>
      <h1 className="text-4xl font-semibold tracking-tight">Diário alimentar</h1>
      <p className="mt-3 text-zinc-400">Registro real vs meta diária de calorias, proteínas, carboidratos, gorduras, fibra e sódio.</p>
      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-3xl border border-white/10 bg-white/[0.025] p-4">
        <Link href="/diario" aria-current={isToday ? "date" : undefined} className={`rounded-full px-4 py-3 text-sm ${isToday ? "bg-lime-300 text-black" : "bg-white/10 text-zinc-200"}`}>Hoje</Link>
        <Link href={`/diario?data=${yesterday}`} aria-current={today === yesterday ? "date" : undefined} className={`rounded-full px-4 py-3 text-sm ${today === yesterday ? "bg-lime-300 text-black" : "bg-white/10 text-zinc-200"}`}>Ontem</Link>
        <form method="get" className="flex min-w-0 flex-wrap items-end gap-2">
          <label className="min-w-0 text-xs text-zinc-400">Consultar outro dia<input key={today} type="date" name="data" defaultValue={today} min="1900-01-01" max={realToday} required className="mt-1 block h-11 max-w-full rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white" /></label>
          <button className="h-11 rounded-full border border-white/15 px-4 text-sm">Ver dia</button>
        </form>
        <p className="text-sm text-zinc-300">{todayStart.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long" })}</p>
      </div>
      {invalidDate || status ? <p role="alert" className="mt-4 rounded-2xl border border-amber-200/20 p-4 text-sm text-amber-100">{invalidDate || status === "invalid-date" ? "Data inválida. Exibindo o diário de hoje." : status === "save-failed" ? "Não foi possível registrar a refeição. Tente novamente." : "A refeição não está disponível. Confira a dieta ativa."}</p> : null}
      <GlassCard className="mt-8 border-lime-300/20 bg-lime-300/[0.035]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-lime-300/15 text-lime-300">
              <Utensils size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-lime-300">{isToday ? "Plano de hoje" : "Plano atual como referência"}</p>
              <h2 className="mt-1 text-xl font-semibold">{activePlan?.name ?? "Nenhuma dieta ativa"}</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500">{isToday ? "Marque a refeição quando consumir os alimentos e as quantidades planejadas." : "Este é seu plano ativo atual. Registre apenas o que você realmente consumiu nesta data."}</p>
            </div>
          </div>
          <Link href="/dieta" className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/15">
            Editar dieta
          </Link>
        </div>

        {activePlan?.meals.length ? (
          <div className="mt-5 grid gap-3">
            {activePlan.meals.map((meal) => {
              const nutrients = sumNutrients(meal.items.map((item) => ({
                grams: item.grams,
                food: {
                  name: item.food.name,
                  kcalPer100g: item.food.kcalPer100g,
                  proteinPer100g: item.food.proteinPer100g,
                  carbsPer100g: item.food.carbsPer100g,
                  fatPer100g: item.food.fatPer100g,
                  fiberPer100g: item.food.fiberPer100g ?? 0,
                  sodiumPer100g: item.food.sodiumPer100g ?? 0,
                },
              })));
              const registeredItems = log?.items.filter((item) => item.sourceDietMealId === meal.id).length ?? 0;
              const wasAdjusted = meal.items.some((planned) => !log?.items.some((logged) => logged.sourceDietMealId === meal.id && logged.foodId === planned.foodId && logged.grams === planned.grams && logged.mealName === meal.name));
              const isCompleted = meal.items.length > 0 && registeredItems === meal.items.length;
              return (
                <div key={meal.id} className={`grid gap-4 rounded-3xl border p-4 transition md:grid-cols-[1fr_auto] md:items-center ${isCompleted ? "border-lime-300/30 bg-lime-300/[0.06]" : "border-white/8 bg-black/25"}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-zinc-100">{meal.name}</h3>
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-lime-300/15 px-2.5 py-1 text-xs font-medium text-lime-200">
                          <CheckCircle2 size={13} /> {wasAdjusted ? "Registrada com ajustes" : "Registrada"}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {meal.items.length ? groupDietMealItems(meal.items).map((group) => {
                        const item = group.items[0];
                        return (
                          <span key={group.key} className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300">
                            {group.kind === "recipe" ? group.name : item.food.name}{" "}
                            <span className="text-zinc-500">{group.kind === "recipe" ? formatRecipePortions(group.portions) : `${formatNumber(item.grams)} g`}</span>
                          </span>
                        );
                      }) : <span className="text-sm text-zinc-500">Esta refeição ainda não tem alimentos.</span>}
                    </div>
                    {meal.items.length ? (
                      <p className="mt-3 text-xs text-zinc-500">
                        {formatNumber(nutrients.kcal)} kcal · P {formatNumber(nutrients.proteinG)} g · C {formatNumber(nutrients.carbsG)} g · G {formatNumber(nutrients.fatG)} g
                      </p>
                    ) : null}
                  </div>

                  {isCompleted ? (
                    <form action={unregisterDietMealAction}>
                      <input type="hidden" name="mealId" value={meal.id} /><input type="hidden" name="date" value={today} />
                      <SubmitButton className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold text-zinc-200 transition hover:bg-white/15 md:w-auto">
                        <RotateCcw size={15} /> Desmarcar
                      </SubmitButton>
                    </form>
                  ) : (
                    <form action={registerDietMealAction}>
                      <input type="hidden" name="mealId" value={meal.id} /><input type="hidden" name="date" value={today} />
                      <SubmitButton pendingLabel="Registrando…" disabled={!meal.items.length} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-lime-300 px-4 text-sm font-semibold text-black transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40 md:w-auto">
                        <Check size={15} /> Registrar refeição
                      </SubmitButton>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
            Ative ou monte uma dieta para registrar refeições completas com um toque.
          </div>
        )}
      </GlassCard>
      <div className="mt-8 grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
        <GlassCard>
          <h2 className="text-xl font-semibold">Registrar alimento</h2>
          <DiaryFoodForm key={today} foods={foods} date={today} />
        </GlassCard>
        <GlassCard>
          <h2 className="text-xl font-semibold">Progresso do dia selecionado</h2>
          {!isToday ? <p className="mt-2 text-xs leading-5 text-zinc-400">Comparação com suas metas atuais. O histórico de alterações de meta ainda não é armazenado.</p> : null}
          <div className="mt-5 grid gap-5">
            {bars.map(([label, value]) => (
              <div key={label}>
                <div className="mb-2 flex justify-between text-sm"><span>{label}</span><span className="text-zinc-500">{value}%</span></div>
                <div className="h-3 rounded-full bg-white/10"><div className="h-3 rounded-full bg-lime-300" style={{ width: `${Math.min(100, Number(value))}%` }} /></div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
      <GlassCard className="mt-4 border-lime-300/20 bg-lime-300/[0.035]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-lime-300/15 text-lime-300">
              <Pill size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Multivitamínico</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500">Confirme a dose tomada para somar os valores do rótulo aos micronutrientes do dia selecionado.</p>
            </div>
          </div>
          <Link href="/suplementos" className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/15">
            Configurar rótulo
          </Link>
        </div>
        {multivitamins.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {multivitamins.map((plan) => {
              const todayLog = plan.logs[0];
              return (
                <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/25 p-4">
                  <div>
                    <p className="font-medium text-zinc-100">{plan.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">Meta: {formatNumber(plan.dailyDoseG)} {supplementDoseUnit("MULTIVITAMIN", plan.dailyDoseG)} por dia</p>
                  </div>
                  {todayLog ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-lime-300/15 px-3 py-2 text-sm font-medium text-lime-200">
                        <Check size={15} /> {formatNumber(todayLog.doseG)} {supplementDoseUnit("MULTIVITAMIN", todayLog.doseG)}
                      </span>
                      <form action={deleteSupplementLogAction}>
                        <input type="hidden" name="logId" value={todayLog.id} />
                        <button className="grid size-9 place-items-center rounded-full bg-white/10 text-zinc-400 transition hover:bg-red-500/20 hover:text-red-200" aria-label={`Remover dose de ${plan.name}`}>
                          <Trash2 size={15} />
                        </button>
                      </form>
                    </div>
                  ) : (
                    <form action={logSupplementDoseAction}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <input type="hidden" name="date" value={today} />
                      <input type="hidden" name="doseG" value={plan.dailyDoseG} />
                      <button className="inline-flex h-10 items-center gap-2 rounded-full bg-lime-300 px-4 text-sm font-semibold text-black transition hover:bg-lime-200">
                        <Check size={15} /> Registrar dose
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
            Nenhum multivitamínico ativo. Cadastre o produto e os dados do rótulo em Suplementos.
          </p>
        )}
      </GlassCard>
      <GlassCard className="mt-4">
        <h2 className="text-xl font-semibold">Micronutrientes</h2>
        <p className="mt-2 text-sm text-zinc-500">Total consumido no dia selecionado, separando o que veio dos alimentos e do multivitamínico registrado.</p>
        {hasMicronutrientData ? (<>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {microBars.map(([label, key, target, unit]) => {
            const value = consumed[key];
            const fromFood = foodConsumed[key];
            const fromSupplement = supplementConsumed[key];
            const pct = target ? Math.round((value / target) * 100) : 0;
            return (
              <div key={label}>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="text-zinc-500">{value.toFixed(1)} / {target} {unit}</span>
                </div>
                <div className="h-3 rounded-full bg-white/10"><div className="h-3 rounded-full bg-sky-300" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                <p className="mt-1.5 text-xs text-zinc-600">Alimentos {fromFood.toFixed(1)} + suplemento {fromSupplement.toFixed(1)} {unit}</p>
              </div>
            );
            })}
          </div>
          {hasSupplementDose ? (
            <div className="mt-7 border-t border-white/10 pt-6">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-zinc-200">Demais nutrientes do multivitamínico</h3>
                  <p className="mt-1 text-xs text-zinc-500">Valores do rótulo da dose confirmada e referência diária para adultos.</p>
                </div>
                <span className="rounded-full bg-lime-300/10 px-3 py-1 text-xs font-medium text-lime-200">
                  {formatNumber(supplementDoseCount)} {supplementDoseCount === 1 ? "cápsula registrada" : "cápsulas registradas"}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {supplementOnlyNutrients.map((nutrient) => {
                  const value = supplementConsumed[nutrient.key];
                  const pct = nutrient.dailyValue ? Math.round((value / nutrient.dailyValue) * 100) : 0;
                  return (
                    <div key={nutrient.key} className="rounded-2xl border border-white/8 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-zinc-300">{nutrient.label}</span>
                        <span className="font-medium text-zinc-100">{formatNumber(value)} {nutrient.unit}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-white/10">
                        <div className="h-1.5 rounded-full bg-lime-300" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <p className="mt-1.5 text-xs text-zinc-600">{pct}% do valor diário</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
        ) : (
          <div className="mt-5 rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-sm leading-6 text-zinc-400">
            Registre alimentos ou confirme seu multivitamínico para ver o progresso de micronutrientes.
          </div>
        )}
      </GlassCard>
      <GlassCard className="mt-4">
        <h2 className="text-xl font-semibold">Itens registrados</h2>
        <div className="mt-4 grid gap-3">
          {log?.items.length ? log.items.map((item) => (
            <DiaryItemEditor key={`${item.id}-${today}`} item={{ id: item.id, foodId: item.foodId, grams: item.grams, mealName: item.mealName, foodName: item.food.name }} date={today} maxDate={realToday} />
          )) : <p className="text-sm text-zinc-500">Nenhum alimento registrado neste dia.</p>}
        </div>
      </GlassCard>
    </AppShell>
  );
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
