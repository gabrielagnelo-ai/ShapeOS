import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import { PageHeading } from "@/components/ui/page-heading";
import { ReliabilityNotice, SafetyReview } from "@/components/diet/reliability-notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { dietaryReviewIssue } from "@/lib/food-reliability";
import { buildFluxaMenuShoppingBudget, buildFluxaShoppingBudget } from "@/lib/fluxa-integration";
import { Check, Plus, Send, ShoppingBag, Trash2, Sunrise, Sun, Moon, Dumbbell, ChevronDown } from "lucide-react";
import { IconTile } from "@/components/ui/group";
import Link from "next/link";
import { ChefHat } from "lucide-react";
import { ShoppingListExport } from "@/components/diet/shopping-list-export";
import { FoodSearchField } from "@/components/food/food-search-field";
import { AppShell } from "@/components/shell/app-shell";
import { MacroRings } from "@/components/today/today-cards";
import { formatRecipePortions, groupDietMealItems } from "@/lib/diet-meal-display";
import { mealNames, mealOrder, normalizeMealName } from "@/lib/meals";
import { prisma } from "@/lib/prisma";
import { computeCurrentProfileMetrics, requireUserProfile } from "@/lib/profile";
import { nutrientsForGrams, toFoodNutrients } from "@/lib/nutrition";
import { averageDailyMenuNutrition, consolidateShoppingList, menuDaysSummary } from "@/lib/diet-menu";
import { DietMenuView } from "@/components/diet/diet-menu";
import { ShoppingItems, itemsLabel, shoppingExportLines } from "@/components/diet/shopping-items";
import {
  addManualDietItemAction,
  createProteinSwapDietPlanAction,
  createManualDietPlanAction,
  deleteDietPlanAction,
  generateDietPlanAction,
  removeDietItemAction,
  removeRecipeFromDietMealAction,
  setActiveDietPlanAction,
  syncShoppingBudgetToFluxaAction,
  updateDietMealsAction,
  updateDietItemGramsAction,
} from "./actions";
import styles from "./diet.module.css";
import { Stack } from "@/components/ui/screen";
import buttons from "@/components/ui/buttons.module.css";
import sections from "@/components/ui/sections.module.css";

type SearchParams = Promise<{ periodo?: string; fluxa?: string; dietStatus?: string }>;

export default async function DietaPage({ searchParams }: { searchParams: SearchParams }) {
  const { periodo, fluxa, dietStatus: actionStatus } = await searchParams;
  const { user, profile } = await requireUserProfile();
  const reviewIssue = dietaryReviewIssue(profile);
  const { metrics } = await computeCurrentProfileMetrics(user.id, profile);
  const dietPlans = await prisma.dietPlan.findMany({
    where: { userId: user.id },
    include: { meals: { include: { items: { include: { food: true, recipe: { select: { id: true, name: true } } } } }, orderBy: { order: "asc" } } },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    take: 12,
  });
  const plan = dietPlans.find((dietPlan) => dietPlan.isActive) ?? null;
  const dietMenu = await prisma.dietMenu.findUnique({
    where: { userId: user.id },
    include: { entries: { orderBy: [{ order: "asc" }, { id: "asc" }], include: { dietPlan: { include: { meals: { include: { items: { include: { food: true } } } } } } } } },
  });
  const menuEntries = (dietMenu?.entries ?? []).map((entry) => ({ entry, items: entry.dietPlan.meals.flatMap((meal) => meal.items), days: entry.days }));
  const menuShopping = consolidateShoppingList(menuEntries);
  const menuAverage = averageDailyMenuNutrition(menuEntries);
  const menuDays = menuDaysSummary(menuEntries);
  const hasMenu = menuEntries.length > 0;
  const useMenu = periodo === "cardapio" && hasMenu;
  const days = useMenu ? menuDays.totalDays : periodo === "semanal" ? 7 : periodo === "mensal" ? 30 : 15;
  const periodLabel = useMenu ? "Cardápio" : days === 7 ? "Semanal" : days === 30 ? "Mensal" : "Quinzenal";
  const planMeals = plan ? sortMeals(plan.meals) : [];
  const mealChoices = uniqueMeals([...mealNames, ...planMeals.map((meal) => normalizeMealName(meal.name))]);
  const activeMealNames = new Set(planMeals.map((meal) => normalizeMealName(meal.name)));
  const foods = await prisma.food.findMany({
    where: { OR: [{ createdByUserId: null }, { createdByUserId: user.id }] },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true, kcalPer100g: true },
  });
  const shoppingList = useMenu ? menuShopping : consolidateShoppingList([{ items: planMeals.flatMap((meal) => meal.items), days }]);
  const monthlyBudget = useMenu
    ? buildFluxaMenuShoppingBudget(menuEntries)
    : buildFluxaShoppingBudget(planMeals.flatMap((meal) => meal.items), 30);
  const budgetLabel = useMenu ? `Cardápio de ${menuDays.totalDays} dias, estimado para 30 dias` : "Valor para 30 dias";
  const totals = planMeals.flatMap((meal) => meal.items).reduce(
    (acc, item) => {
      const n = nutrientsForGrams(toFoodNutrients(item.food), item.grams);
      return {
        kcal: acc.kcal + n.kcal,
        protein: acc.protein + n.proteinG,
        carbs: acc.carbs + n.carbsG,
        fat: acc.fat + n.fatG,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const planStatus = totals ? dietStatus(Math.round(totals.kcal), metrics.targets.calories) : null;

  const mealView = <div className={styles.mealWorkspace}>
    <div className={sections.heading}><div><h2>Suas refeições</h2><p>Abra uma refeição para conferir ou ajustar as porções.</p></div><a href="/receitas" className={buttons.secondary}>Minhas receitas <span aria-hidden="true">↗</span></a></div>
          <div className={styles.meals}>
            {plan ? planMeals.map((meal, index) => {
              const mealTotals = planSummary([meal]);
              const MealIcon = /treino/i.test(meal.name) ? Dumbbell : index === 0 ? Sunrise : /jantar|ceia/i.test(meal.name) ? Moon : Sun;
              return (
              <details key={meal.id} className={styles.meal}>
                <summary><span className={styles.mealSymbol}><MealIcon size={22} /></span><div className={styles.mealTitle}><h3>{normalizeMealName(meal.name)}</h3><p>{groupDietMealItems(meal.items).map((group) => group.kind === "recipe" ? group.name : group.items[0].food.name).join(" · ") || "Adicione os alimentos desta refeição"}</p></div><div className={styles.mealEnergy}><strong>{Math.round(mealTotals.kcal).toLocaleString("pt-BR")}</strong><span>kcal</span></div><ChevronDown size={18} className={styles.mealChevron} /></summary>
                <div className={styles.mealNutrients}><span>Proteína <b>{Math.round(mealTotals.protein)} g</b></span><span>Carboidrato <b>{Math.round(mealTotals.carbs)} g</b></span><span>Gordura <b>{Math.round(mealTotals.fat)} g</b></span></div>
                <div className={styles.mealEditor}>
                  {groupDietMealItems(meal.items).map((group) => {
                    if (group.kind === "recipe") {
                      const recipeKcal = group.items.reduce((total, item) => total + nutrientsForGrams(toFoodNutrients(item.food), item.grams).kcal, 0);
                      return (
                        <div key={group.key} className={styles.foodRow}>
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <IconTile icon={ChefHat} colour="orange" size="sm" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{group.name}</p>
                              <p className="mt-0.5 text-xs text-text-muted">{formatRecipePortions(group.portions)} · {Math.round(recipeKcal)} kcal</p>
                            </div>
                          </div>
                          <form action={removeRecipeFromDietMealAction}>
                            <input type="hidden" name="recipeBatchId" value={group.recipeBatchId ?? ""} />
                            <SubmitButton className="inline-flex size-10 items-center justify-center rounded-full bg-fill text-text-secondary hover:bg-danger/15 hover:text-danger" aria-label={`Remover receita ${group.name}`}>
                              <Trash2 size={15} />
                            </SubmitButton>
                          </form>
                        </div>
                      );
                    }

                    const item = group.items[0];
                    const nutrients = nutrientsForGrams(toFoodNutrients(item.food), item.grams);
                    return (
                      <div key={group.key} className={styles.foodRow}>
                        <span className="min-w-0 flex-1 text-sm">{item.food.name} <span className="text-text-muted">· {nutrients.kcal.toLocaleString("pt-BR")} kcal</span></span>
                        <form action={updateDietItemGramsAction} className="flex items-center gap-2">
                          <input type="hidden" name="itemId" value={item.id} />
                          <input aria-label={`Gramas de ${item.food.name}`} name="grams" defaultValue={item.grams} className="h-10 w-24 rounded-[14px] px-3 text-sm outline-none" />
                          <SubmitButton className="min-h-10 rounded-full bg-fill px-4 text-sm font-semibold hover:bg-fill-strong">Salvar</SubmitButton>
                        </form>
                        <form action={removeDietItemAction}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <SubmitButton className="inline-flex size-10 items-center justify-center rounded-full bg-fill text-text-secondary hover:bg-danger/15 hover:text-danger" aria-label="Remover alimento">
                            <Trash2 size={15} />
                          </SubmitButton>
                        </form>
                      </div>
                    );
                  })}
                  <form action={addManualDietItemAction} className="grid gap-2 rounded-[14px] bg-surface-tertiary p-3 md:grid-cols-[minmax(0,1fr)_110px_auto]">
                    <input type="hidden" name="mealId" value={meal.id} />
                    <SafetyReview required={Boolean(reviewIssue)} />
                    <FoodSearchField
                      foods={foods}
                      className="h-11 w-full rounded-[14px] px-3 text-sm outline-none"
                      placeholder="Digite para buscar alimento"
                    />
                    <input aria-label="Quantidade em gramas" name="grams" inputMode="decimal" className="h-11 rounded-[14px] px-3 text-sm outline-none" placeholder="gramas" required />
                    <SubmitButton className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary/15 px-4 text-sm font-semibold text-primary hover:bg-primary/20">
                      <Plus size={15} />
                      Adicionar
                    </SubmitButton>
                  </form>
                </div>
              </details>
              );
            }) : <p className="text-sm text-text-muted">Gere um plano, monte uma dieta manual ou escolha Usar em uma das opções salvas.</p>}
          </div>
  </div>;
  const management = <section className={`${sections.section} ${styles.planWorkspace}`}><div className={sections.heading}><h2>Meus planos</h2><form action={generateDietPlanAction}><SubmitButton className={buttons.secondary}>Gerar básico</SubmitButton></form></div>

          <form id="plano-manual" action={createManualDietPlanAction} className="mt-5 rounded-[14px] bg-surface-tertiary p-4">
            <SafetyReview required={Boolean(reviewIssue)} />
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-0 flex-1">
                <span className="text-sm text-text-secondary">Plano manual do nutricionista</span>
                <input
                  name="name"
                  className="mt-2 h-11 w-full rounded-[14px] px-4 text-sm outline-none"
                  placeholder="Ex: Dieta prescrita - fase 1"
                />
              </label>
              <SubmitButton className="inline-flex min-h-11 items-center gap-2 rounded-full bg-fill px-4 text-sm font-semibold hover:bg-fill-strong">
                <Plus size={16} />
                Criar manual
              </SubmitButton>
            </div>
            <p className="mt-2 text-xs leading-5 text-text-muted">
              Dê um nome ao plano e adicione os alimentos com suas quantidades.
            </p>
          </form>
          <div className="mt-5 rounded-[14px] bg-surface-tertiary p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold">Opções de dieta</p>
                <p className="mt-1 max-w-xl text-sm leading-6 text-text-muted">
                  Duplique o plano com outra fonte de proteína ou escolha uma dieta salva.
                </p>
              </div>
              <span className="text-xs text-text-muted">{dietPlans.length} salvas</span>
            </div>

            {dietPlans.length ? (
              <div className="mt-3 grid lg:grid-cols-2 lg:gap-x-6">
                {dietPlans.map((dietPlan, index) => {
                  const summary = planSummary(dietPlan.meals);
                  return (
                    <div key={dietPlan.id} className="border-b border-hairline py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold">{dietPlan.name || `Dieta ${index + 1}`}</p>
                            {dietPlan.isActive ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><Check size={13} aria-hidden="true" />Ativa</span> : null}
                          </div>
                          <p className="mt-1 text-xs text-text-muted">
                            {Math.round(summary.kcal)} kcal · P {Math.round(summary.protein)}g C {Math.round(summary.carbs)}g G {Math.round(summary.fat)}g
                          </p>
                        </div>
                        <div className="flex min-w-0 flex-wrap gap-1">
                          {!dietPlan.isActive ? (
                            <form action={setActiveDietPlanAction} className="max-w-60">
                              <SafetyReview required={Boolean(reviewIssue)} />
                              <input type="hidden" name="planId" value={dietPlan.id} />
                              <SubmitButton className="min-h-9 rounded-full bg-primary/15 px-3.5 text-xs font-semibold text-primary hover:bg-primary/20">Usar</SubmitButton>
                            </form>
                          ) : null}
                          {dietPlans.length > 1 ? (
                            <form action={deleteDietPlanAction}>
                              <input type="hidden" name="planId" value={dietPlan.id} />
                              <SubmitButton className="inline-flex size-9 items-center justify-center rounded-full bg-fill text-text-secondary hover:bg-danger/15 hover:text-danger" aria-label="Excluir dieta">
                                <Trash2 size={14} />
                              </SubmitButton>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-text-muted">Crie ou gere uma dieta para salvar a primeira opção.</p>
            )}

            <form action={createProteinSwapDietPlanAction} className="mt-4 grid gap-2 pt-1 lg:grid-cols-[1fr_1.2fr_auto]">
              <input name="variantName" className="h-11 rounded-[14px] px-4 text-sm outline-none" placeholder="Nome. Ex: Dieta 2 - tilápia" />
              <FoodSearchField
                foods={foods}
                className="h-11 w-full rounded-[14px] px-4 text-sm outline-none"
                placeholder="Nova proteína. Ex: tilápia, patinho, whey"
              />
              <SubmitButton disabled={!plan} className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-40">
                Criar variação
              </SubmitButton>
            </form>
            <p className="mt-3 text-xs leading-5 text-text-muted">
              A troca preserva aproximadamente a proteína da refeição. Calorias e gordura podem mudar conforme o alimento escolhido.
            </p>
          </div>
          <form action={updateDietMealsAction} className="mt-5 rounded-[14px] bg-surface-tertiary p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold">Refeições do plano</p>
                <p className="mt-1 max-w-xl text-sm leading-6 text-text-muted">
                  Marque só as refeições que você realmente faz. Se você treina 6h e não usa pré-treino, desmarque essa opção.
                </p>
              </div>
              <SubmitButton disabled={!plan} className="min-h-10 rounded-full bg-fill px-4 text-sm font-semibold hover:bg-fill-strong disabled:cursor-not-allowed disabled:opacity-40">
                Salvar refeições
              </SubmitButton>
            </div>
            <div className="mt-3 grid sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-3">
              {mealChoices.map((mealName) => (
                <label key={mealName} className="flex min-h-12 items-center justify-between gap-3 border-b border-hairline text-sm">
                  {mealName}
                  <input
                    type="checkbox"
                    name="mealNames"
                    value={mealName}
                    defaultChecked={!plan || activeMealNames.has(mealName)}
                    className="switch"
                    disabled={!plan}
                  />
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-text-muted">
              Ao remover uma refeição, os alimentos dela saem do plano ativo. Revise as porções das refeições restantes para manter sua meta diária.
            </p>
          </form>

  </section>;
  const shoppingView = (        <section className={`${sections.section} ${styles.shoppingWorkspace}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <IconTile icon={ShoppingBag} colour="green" />
              <div>
                <h2>Lista de compras</h2>
                <p className="text-sm text-text-muted">{periodLabel} · {days} dias</p>
              </div>
            </div>
            <div role="group" aria-label="Período da lista" className="inline-flex rounded-full bg-fill p-[3px] text-sm">
              {([[7, "semanal", "7 dias"], [15, "quinzenal", "15 dias"], [30, "mensal", "30 dias"], ...(hasMenu ? [[0, "cardapio", "Cardápio"] as const] : [])] as const).map(([count, slug, label]) => {
                const selected = slug === "cardapio" ? useMenu : !useMenu && days === count;
                return <Link key={slug} href={`/dieta?periodo=${slug}#compras`} aria-current={selected ? "true" : undefined} className={`inline-flex min-h-[34px] items-center rounded-full px-3.5 ${selected ? "bg-[var(--glass-selected)] font-semibold text-text-primary shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)]" : "text-text-secondary hover:text-text-primary"}`}>{label}</Link>;
              })}
            </div>
          </div>
          <details className={styles.planManagement}><summary>Enviar estimativa ao Fluxa</summary><div className="grid gap-3 py-3">
            <div>
              <p className="text-sm font-medium">Meta de mercado no Fluxa</p>
              <p className="mt-1 text-xs text-text-muted">{useMenu ? `Atualiza a meta mensal de Mercado com o cardápio de ${menuDays.totalDays} dias proporcional a 30 dias, sem registrar uma compra paga.` : "Atualiza a meta mensal de Mercado com a estimativa de 30 dias, sem registrar uma compra paga."}</p>
            </div>
            <form action={syncShoppingBudgetToFluxaAction} className="grid w-full gap-3">
              <p className="text-sm">{budgetLabel}: <strong>{monthlyBudget.summary.estimatedTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong> · {monthlyBudget.summary.pricedItemCount} de {itemsLabel(monthlyBudget.items.length)} com preço.</p>
              <p className="text-xs leading-5 text-text-muted">Ao confirmar, a meta mensal de Mercado será substituída por este valor. Uma meta ajustada manualmente no Fluxa também será substituída.</p>
              {monthlyBudget.summary.missingPriceCount > 0 ? <label className="flex items-start gap-2 text-xs leading-5 text-warning"><input type="checkbox" name="confirmPartialEstimate" required className="mt-1" />Estou ciente de que {itemsLabel(monthlyBudget.summary.missingPriceCount)} {monthlyBudget.summary.missingPriceCount === 1 ? "está" : "estão"} sem preço e quero enviar apenas a estimativa parcial.</label> : null}
              <input type="hidden" name="periodo" value={useMenu ? "cardapio" : periodo && periodo !== "cardapio" ? periodo : "quinzenal"} />
              <SubmitButton disabled={(useMenu ? !hasMenu : !plan?.isActive) || monthlyBudget.summary.estimatedTotal <= 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-fill px-4 text-sm font-semibold hover:bg-fill-strong disabled:opacity-40">
                <Send size={15} />
                Confirmar atualização da meta
              </SubmitButton>
            </form>
          </div>
          </details>
          {fluxa ? <FluxaSyncStatus status={fluxa} /> : null}
          <ShoppingListExport title={useMenu ? `Lista de compras ShapeOS - Cardápio (${days} dias)` : `Lista de compras ShapeOS - ${days} dias`} items={shoppingExportLines(shoppingList.items)} />
          <ShoppingItems
            items={shoppingList.items}
            estimatedCost={shoppingList.estimatedCost}
            missingPriceCount={shoppingList.missingPriceCount}
            costLabel={useMenu ? "Custo estimado do cardápio" : "Custo estimado do período"}
            emptyText="Gere um plano para ver a lista."
          />
        </section>);
  const menuView = <DietMenuView
    entries={menuEntries.map(({ entry, items }) => ({
      id: entry.id,
      planName: entry.dietPlan.name,
      days: entry.days,
      kcalPerDay: averageDailyMenuNutrition([{ items, days: 1 }]).kcal,
      isActivePlan: entry.dietPlan.isActive,
    }))}
    plans={dietPlans.map((dietPlan) => ({ id: dietPlan.id, name: dietPlan.name }))}
    average={menuAverage}
    targets={metrics.targets}
    totalDays={menuDays.totalDays}
    exceedsMonth={menuDays.exceedsMonth}
    shopping={menuShopping}
  />;
  const plannedMacros = [
    { label: "Calorias", value: totals.kcal, target: metrics.targets.calories, unit: "kcal", color: "#eef0eb" },
    { label: "Proteínas", value: totals.protein, target: metrics.targets.proteinG, unit: "g", color: "#77cce9" },
    { label: "Carboidratos", value: totals.carbs, target: metrics.targets.carbsG, unit: "g", color: "#b9f83e" },
    { label: "Gorduras", value: totals.fat, target: metrics.targets.fatG, unit: "g", color: "#f7c744" },
  ];

  return <AppShell>
    <PageHeading title="Dieta" description={plan?.name ?? "Organize suas refeições."}><a href="/diario">Abrir diário</a></PageHeading>
    <Stack>
    <ReliabilityNotice status={actionStatus ?? reviewIssue} />
    {plan && planStatus && <section className={`panel ${styles.overview}`} aria-label="Resumo do plano alimentar">
      <header><h2>Planejado no dia</h2></header>
      <div className={styles.calories}>
        <MacroRings
          className={styles.rings}
          rings={plannedMacros.map((macro) => ({ pct: macro.value / Math.max(1, macro.target) * 100, color: macro.color }))}
          value={Math.round(totals.kcal).toLocaleString("pt-BR")}
          caption="kcal planejadas"
          label={plannedMacros.map((macro) => `${macro.label}: ${Math.round(macro.value)} de ${macro.target} ${macro.unit} planejados`).join("; ")}
        />
      </div>
      <div className={styles.macros}>{plannedMacros.map((macro) => <div key={macro.label}><div><span>{macro.label}</span><strong>{Math.round(macro.value).toLocaleString("pt-BR")} <small>/ {macro.target.toLocaleString("pt-BR")} {macro.unit}</small></strong></div><progress max={Math.max(1,macro.target)} value={macro.value} aria-label={`${macro.label}: ${Math.round(macro.value)} de ${macro.target} ${macro.unit} planejados`} /></div>)}</div>
      <footer><span>{planStatus.label}</span><p>{planStatus.diffLabel}. Ajuste as porções nas refeições abaixo.</p></footer>
    </section>}
    <WorkspaceTabs label="Organizar dieta" initial={!plan ? 2 : 0} items={[
      { id:"refeicoes", label:"Refeições", content:mealView },
      { id:"compras", label:"Compras", content:shoppingView },
      { id:"planos", label:"Meus planos", content:management },
      { id:"cardapio", label:"Cardápio", content:menuView },
    ]} />
    </Stack>
  </AppShell>;
}

function FluxaSyncStatus({ status }: { status: string }) {
  const messages: Record<string, { text: string; tone: string }> = {
    ok: { text: "Meta mensal de Mercado atualizada no Fluxa.", tone: "bg-success/10 text-success" },
    config: { text: "A conexão com o Fluxa ainda não está disponível. Tente novamente mais tarde.", tone: "bg-warning/10 text-warning" },
    "no-plan": { text: "Ative uma dieta antes de enviar ao Fluxa.", tone: "bg-warning/10 text-warning" },
    "no-menu": { text: "Adicione planos ao cardápio antes de enviar ao Fluxa.", tone: "bg-warning/10 text-warning" },
    "no-prices": { text: "Cadastre preços nos alimentos antes de enviar o orçamento.", tone: "bg-warning/10 text-warning" },
    "partial-prices": { text: "Há itens sem preço. Confira o valor mensal e confirme o envio da estimativa parcial.", tone: "bg-warning/10 text-warning" },
    account: { text: "Não encontrei no Fluxa uma conta com o mesmo e-mail.", tone: "bg-warning/10 text-warning" },
    offline: { text: "O Fluxa não respondeu. Tente novamente em alguns instantes.", tone: "bg-danger/10 text-danger" },
    error: { text: "O Fluxa recusou a sincronização. Confira a configuração.", tone: "bg-danger/10 text-danger" },
  };
  const message = messages[status];
  if (!message) return null;
  return <p className={`mt-3 rounded-[14px] px-4 py-3 text-sm ${message.tone}`}>{message.text}</p>;
}

function dietStatus(planned: number, target: number) {
  const diff = planned - target;
  const abs = Math.abs(diff);
  if (abs <= 100) {
    return {
      label: "Dentro da meta",
      diffLabel: `${abs} kcal de diferença`,
      className: "border-lime-300/25 bg-lime-300/10",
    };
  }

  if (diff < 0) {
    return {
      label: "Abaixo da meta",
      diffLabel: `${abs} kcal abaixo`,
      className: "border-sky-300/25 bg-sky-300/10",
    };
  }

  return {
    label: "Acima da meta",
    diffLabel: `${abs} kcal acima`,
    className: "border-amber-300/25 bg-amber-300/10",
  };
}

function planSummary(meals: Array<{
  items: Array<{
    grams: number;
    food: {
      name: string;
      kcalPer100g: number;
      proteinPer100g: number;
      carbsPer100g: number;
      fatPer100g: number;
      fiberPer100g?: number | null;
      sodiumPer100g?: number | null;
    };
  }>;
}>) {
  return meals.flatMap((meal) => meal.items).reduce(
    (acc, item) => {
      const nutrients = nutrientsForGrams(toFoodNutrients(item.food), item.grams);

      return {
        kcal: acc.kcal + nutrients.kcal,
        protein: acc.protein + nutrients.proteinG,
        carbs: acc.carbs + nutrients.carbsG,
        fat: acc.fat + nutrients.fatG,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function uniqueMeals(meals: string[]) {
  return [...new Set(meals)];
}

function sortMeals<T extends { name: string; order: number }>(meals: T[]) {
  return [...meals].sort((a, b) => mealOrder(a.name) - mealOrder(b.name) || a.order - b.order);
}
