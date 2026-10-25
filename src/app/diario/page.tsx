import styles from "./diary.module.css";
import { Hero, Section, Stack } from "@/components/ui/screen";
import { AppShell } from "@/components/shell/app-shell";
import { DiaryFoodForm, DiaryItemEditor } from "@/components/food/diary-forms";
import { SubmitButton } from "@/components/ui/submit-button";
import { diaryDate } from "@/lib/diary-input";
import Link from "next/link";
import { Check, CheckCircle2, ChevronDown, Pill, Plus, RotateCcw, Trash2, Utensils } from "lucide-react";
import { appDateInputValue, endOfTodayInAppTimeZone } from "@/lib/date-time";
import { formatRecipePortions, groupDietMealItems } from "@/lib/diet-meal-display";
import { prisma } from "@/lib/prisma";
import { computeCurrentProfileMetrics, requireUserProfile, startOfToday } from "@/lib/profile";
import { macroProgress, sumNutrients, toFoodNutrients } from "@/lib/nutrition";
import { sumSupplementMicronutrients, supplementDoseUnit, supplementNutrientDefinitions } from "@/lib/supplements";
import { registerDietMealAction, unregisterDietMealAction } from "./actions";
import { deleteSupplementLogAction, logSupplementDoseAction } from "@/app/suplementos/actions";
import { formatNumber } from "@/lib/common";

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
      food: toFoodNutrients(item.food),
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
  const macros = [
    { label: "Calorias", value: consumed.kcal, target: metrics.targets.calories, progress: progress.calories, unit: "kcal", color: "#eef0eb" },
    { label: "Proteína", value: consumed.proteinG, target: metrics.targets.proteinG, progress: progress.protein, unit: "g", color: "#77cce9" },
    { label: "Carboidrato", value: consumed.carbsG, target: metrics.targets.carbsG, progress: progress.carbs, unit: "g", color: "#b9f83e" },
    { label: "Gordura", value: consumed.fatG, target: metrics.targets.fatG, progress: progress.fat, unit: "g", color: "#f7c744" },
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
      <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Diário alimentar</h1>
          <p>{todayStart.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div className={styles.headerActions}>
      <div className={styles.dayControls}>
        <div className={styles.days} role="group" aria-label="Dia do diário">
          <Link href="/diario" aria-current={isToday ? "date" : undefined}>Hoje</Link>
          <Link href={`/diario?data=${yesterday}`} aria-current={today === yesterday ? "date" : undefined}>Ontem</Link>
        </div>
        <details className={styles.datePicker}><summary aria-label="Escolher data do diário">{todayStart.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</summary><form method="get" className="flex min-w-0 flex-wrap items-end gap-2">
          <label className="min-w-0 text-xs text-text-muted">Consultar outro dia<input key={today} type="date" name="data" defaultValue={today} min="1900-01-01" max={realToday} required className="mt-1 block h-11 max-w-full rounded-[14px] px-3 text-sm" /></label>
          <button className="h-11 rounded-full bg-fill px-4 text-sm hover:bg-fill-strong">Ver dia</button>
        </form></details>
      </div>
          <a href="#registrar-alimento" className={styles.primaryAction} aria-label="Registrar alimento"><Plus size={17} aria-hidden="true" /><span className={styles.actionLabel}>Registrar<span> alimento</span></span></a>
        </div>
      </header>
      {invalidDate || status ? <p role="alert" className="mt-4 rounded-[14px] bg-warning/10 p-4 text-sm text-warning">{invalidDate || status === "invalid-date" ? "Data inválida. Exibindo o diário de hoje." : status === "save-failed" ? "Não foi possível registrar a refeição. Tente novamente." : "A refeição não está disponível. Confira a dieta ativa."}</p> : null}
      <Stack>
      <Hero aria-label="Consumo e metas do dia">
      <div className={styles.summary}>
        <div className={styles.energy}>
          <svg className={styles.rings} viewBox="0 0 220 220" aria-hidden="true">
            {macros.map((macro, index) => (
              <g key={macro.label}>
                <circle className={styles.ringTrack} cx="110" cy="110" r={102 - index * 14} fill="none" strokeWidth="9" />
                <circle cx="110" cy="110" r={102 - index * 14} fill="none" stroke={macro.color} strokeWidth="9" strokeLinecap="round" pathLength="100" strokeDasharray={`${Math.min(100, Math.max(0, macro.progress))} 100`} transform="rotate(-90 110 110)" opacity={macro.progress > 0 ? 1 : 0} />
              </g>
            ))}
          </svg>
          <div className={styles.energyLabel}>
            <p className={styles.energyValue}>{formatNumber(Math.abs(metrics.targets.calories - consumed.kcal))}</p>
            <p className={styles.target}>{consumed.kcal > metrics.targets.calories ? "kcal acima da meta" : "kcal restantes"}</p>
          </div>
        </div>
        <div className={styles.nutrients}>
          {macros.map((macro) => (
            <div key={macro.label} className={styles.macro} data-nutrient={macro.label}>
              <div><span className={styles.macroName}><i style={{ background: macro.color }} aria-hidden="true" />{macro.label}</span><p><strong>{formatNumber(macro.value)}</strong><span> / {formatNumber(macro.target)} {macro.unit}</span></p></div>
              <progress max={100} value={Math.min(100, macro.progress)} aria-label={macro.label} aria-valuetext={`${formatNumber(macro.value)} de ${macro.target} ${macro.unit === "g" ? "gramas" : "kcal"}, ${macro.progress}% da meta`} />
            </div>
          ))}
          <dl className={styles.secondaryNutrients}>
            <div><dt>Fibra</dt><dd><strong>{formatNumber(consumed.fiberG ?? 0)}</strong> / {formatNumber(metrics.targets.fiberG ?? 30)} g</dd></div>
            <div><dt>Sódio</dt><dd><strong>{formatNumber(consumed.sodiumMg ?? 0)}</strong> / {formatNumber(metrics.targets.sodiumMg ?? 2300)} mg</dd></div>
          </dl>
        </div>
        {!isToday ? <p className={styles.historyNote}>Comparação com suas metas atuais. O histórico de alterações de meta ainda não é armazenado.</p> : null}
      </div>
      </Hero>
      {/* The plan's meals first: one tap registers a whole meal. The manual form sits beside them. */}
      <Section title="Registrar" columns="wide">
      <section className={styles.plan} aria-labelledby="diary-meals-title">
        <header className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}><Utensils size={20} aria-hidden="true" /></span>
            <div>
            <h3 id="diary-meals-title">Refeições da dieta</h3>
            <p>{activePlan?.name ?? "Nenhuma dieta ativa"}</p>
            </div>
          </div>
          <Link href="/dieta" className={styles.textAction}>Editar dieta</Link>
        </header>
        {!isToday ? <p className={styles.referenceNote}>Plano ativo atual como referência. Registre apenas o que você consumiu nesta data.</p> : null}

        {activePlan?.meals.length ? (
          <div className={styles.mealList}>
            {activePlan.meals.map((meal) => {
              const nutrients = sumNutrients(meal.items.map((item) => ({
                grams: item.grams,
                food: toFoodNutrients(item.food),
              })));
              const registeredItems = log?.items.filter((item) => item.sourceDietMealId === meal.id).length ?? 0;
              const wasAdjusted = meal.items.some((planned) => !log?.items.some((logged) => logged.sourceDietMealId === meal.id && logged.foodId === planned.foodId && logged.grams === planned.grams && logged.mealName === meal.name));
              const isCompleted = meal.items.length > 0 && registeredItems === meal.items.length;
              return (
                <div key={meal.id} className={styles.mealRow}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{meal.name}</h3>
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                          <CheckCircle2 size={13} /> {wasAdjusted ? "Registrada com ajustes" : "Registrada"}
                        </span>
                      ) : null}
                    </div>
                    <div className={styles.ingredients}>
                      {meal.items.length ? groupDietMealItems(meal.items).map((group) => {
                        const item = group.items[0];
                        return (
                          <span key={group.key} className={styles.ingredient}>
                            {group.kind === "recipe" ? group.name : item.food.name}{" "}
                            <span className="text-text-muted">{group.kind === "recipe" ? formatRecipePortions(group.portions) : `${formatNumber(item.grams)} g`}</span>
                          </span>
                        );
                      }) : <span className="text-sm text-text-muted">Esta refeição ainda não tem alimentos.</span>}
                    </div>
                    {meal.items.length ? (
                      <p className={styles.mealNutrition}>
                        {formatNumber(nutrients.kcal)} kcal · P {formatNumber(nutrients.proteinG)} g · C {formatNumber(nutrients.carbsG)} g · G {formatNumber(nutrients.fatG)} g
                      </p>
                    ) : null}
                  </div>

                  {isCompleted ? (
                    <form action={unregisterDietMealAction}>
                      <input type="hidden" name="mealId" value={meal.id} /><input type="hidden" name="date" value={today} />
                      <SubmitButton className={styles.undoMeal}>
                        <RotateCcw size={15} /> Desmarcar
                      </SubmitButton>
                    </form>
                  ) : (
                    <form action={registerDietMealAction}>
                      <input type="hidden" name="mealId" value={meal.id} /><input type="hidden" name="date" value={today} />
                      <SubmitButton pendingLabel="Registrando…" disabled={!meal.items.length} className={styles.registerMeal}>
                        <Check size={15} /> Registrar refeição
                      </SubmitButton>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyPlan}>
            Ative ou monte uma dieta para registrar refeições completas com um toque.
          </div>
        )}
      </section>
        <section id="registrar-alimento" tabIndex={-1} className={styles.foodForm} aria-labelledby="diary-food-title">
          <h3 id="diary-food-title">Registrar alimento</h3>
          <DiaryFoodForm key={today} foods={foods} date={today} />
        </section>
      </Section>
      <Section title="Itens registrados">
      <div className={styles.entries}>
        <div className={styles.entryList}>
          {log?.items.length ? log.items.map((item) => (
            <DiaryItemEditor key={`${item.id}-${today}`} item={{ id: item.id, foodId: item.foodId, grams: item.grams, mealName: item.mealName, foodName: item.food.name }} date={today} maxDate={realToday} />
          )) : <p className={styles.empty}>Nenhum alimento registrado neste dia.</p>}
        </div>
      </div>
      </Section>
      <Section title="Suplemento e micronutrientes">
      <details className={styles.secondarySection}>
        <summary><span><Pill size={19} aria-hidden="true" />Multivitamínico</span><ChevronDown size={18} aria-hidden="true" /></summary>
        <div className={styles.secondaryBody}>
          <div className={styles.supplementIntro}>
            <p>Confirme a dose tomada para somar os valores do rótulo aos micronutrientes do dia selecionado.</p>
            <Link href="/suplementos" className={styles.textAction}>Configurar rótulo</Link>
          </div>
        {multivitamins.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {multivitamins.map((plan) => {
              const todayLog = plan.logs[0];
              return (
                <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-surface-tertiary p-4">
                  <div>
                    <p className="font-medium">{plan.name}</p>
                    <p className="mt-1 text-xs text-text-muted">Meta: {formatNumber(plan.dailyDoseG)} {supplementDoseUnit("MULTIVITAMIN", plan.dailyDoseG)} por dia</p>
                  </div>
                  {todayLog ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-2 px-1 text-sm font-semibold text-success">
                        <Check size={15} /> {formatNumber(todayLog.doseG)} {supplementDoseUnit("MULTIVITAMIN", todayLog.doseG)}
                      </span>
                      <form action={deleteSupplementLogAction}>
                        <input type="hidden" name="logId" value={todayLog.id} />
                        <button className="grid size-10 place-items-center rounded-full bg-fill text-text-secondary hover:bg-danger/15 hover:text-danger" aria-label={`Remover dose de ${plan.name}`}>
                          <Trash2 size={15} />
                        </button>
                      </form>
                    </div>
                  ) : (
                    <form action={logSupplementDoseAction}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <input type="hidden" name="date" value={today} />
                      <input type="hidden" name="doseG" value={plan.dailyDoseG} />
                      <button className="inline-flex h-10 items-center gap-2 rounded-full bg-primary/15 px-4 text-sm font-semibold text-primary hover:bg-primary/20">
                        <Check size={15} /> Registrar dose
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 text-sm text-text-muted">
            Nenhum multivitamínico ativo. Cadastre o produto e os dados do rótulo em Suplementos.
          </p>
        )}
        </div>
      </details>
      <details className={styles.secondarySection}>
        <summary><span>Micronutrientes</span><ChevronDown size={18} aria-hidden="true" /></summary>
        <div className={styles.secondaryBody}>
        <p className="mt-2 text-sm text-text-muted">Total consumido no dia selecionado, separando o que veio dos alimentos e do multivitamínico registrado.</p>
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
                  <span className="tabular-nums text-text-muted">{value.toFixed(1)} / {target} {unit}</span>
                </div>
                <div className="h-1.5 rounded-full bg-fill"><div className="h-1.5 rounded-full bg-[var(--protein)]" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                <p className="mt-1.5 text-xs text-text-muted">Alimentos {fromFood.toFixed(1)} + suplemento {fromSupplement.toFixed(1)} {unit}</p>
              </div>
            );
            })}
          </div>
          {hasSupplementDose ? (
            <div className="mt-7 border-t border-hairline pt-6">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="font-semibold">Demais nutrientes do multivitamínico</h3>
                  <p className="mt-1 text-xs text-text-muted">Valores do rótulo da dose confirmada e referência diária para adultos.</p>
                </div>
                <span className="rounded-full bg-fill px-3 py-1 text-xs text-text-secondary">
                  {formatNumber(supplementDoseCount)} {supplementDoseCount === 1 ? "cápsula registrada" : "cápsulas registradas"}
                </span>
              </div>
              <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                {supplementOnlyNutrients.map((nutrient) => {
                  const value = supplementConsumed[nutrient.key];
                  const pct = nutrient.dailyValue ? Math.round((value / nutrient.dailyValue) * 100) : 0;
                  return (
                    <div key={nutrient.key}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-text-secondary">{nutrient.label}</span>
                        <span className="font-medium tabular-nums">{formatNumber(value)} {nutrient.unit}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-fill">
                        <div className="h-1.5 rounded-full bg-[var(--protein)]" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <p className="mt-1.5 text-xs text-text-muted">{pct}% do valor diário</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
        ) : (
          <div className="mt-5 text-sm leading-6 text-text-muted">
            Registre alimentos ou confirme seu multivitamínico para ver o progresso de micronutrientes.
          </div>
        )}
        </div>
      </details>
      </Section>
      </Stack>
      </div>
    </AppShell>
  );
}
