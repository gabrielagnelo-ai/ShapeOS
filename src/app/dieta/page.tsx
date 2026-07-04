import { Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { FoodSearchField } from "@/components/food/food-search-field";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { mealNames, mealOrder, normalizeMealName } from "@/lib/meals";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics, requireUserProfile } from "@/lib/profile";
import { nutrientsForGrams } from "@/lib/nutrition";
import {
  addManualDietItemAction,
  createProteinSwapDietPlanAction,
  createManualDietPlanAction,
  deleteDietPlanAction,
  generateAiDietPlanAction,
  generateDietPlanAction,
  removeDietItemAction,
  setActiveDietPlanAction,
  updateDietMealsAction,
  updateDietItemGramsAction,
} from "./actions";

type SearchParams = Promise<{ periodo?: string }>;

export default async function DietaPage({ searchParams }: { searchParams: SearchParams }) {
  const { periodo } = await searchParams;
  const days = periodo === "mensal" ? 30 : 15;
  const { user, profile } = await requireUserProfile();
  const metrics = computeProfileMetrics(profile);
  const dietPlans = await prisma.dietPlan.findMany({
    where: { userId: user.id },
    include: { meals: { include: { items: { include: { food: true } } }, orderBy: { order: "asc" } } },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    take: 12,
  });
  const plan = dietPlans.find((dietPlan) => dietPlan.isActive) ?? dietPlans[0] ?? null;
  const planMeals = plan ? sortMeals(plan.meals) : [];
  const mealChoices = uniqueMeals([...mealNames, ...planMeals.map((meal) => normalizeMealName(meal.name))]);
  const activeMealNames = new Set(planMeals.map((meal) => normalizeMealName(meal.name)));
  const foods = await prisma.food.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true },
  });
  const shopping = new Map<string, {
    category: string;
    plannedReadyGrams: number;
    buyGrams: number;
    unitLabel: string;
    pricePerKg: number | null;
  }>();
  planMeals.forEach((meal) => meal.items.forEach((item) => {
    const factor = cookingYieldFactor(item.food.name, item.food.category);
    const current = shopping.get(item.food.name) ?? {
      category: item.food.category,
      plannedReadyGrams: 0,
      buyGrams: 0,
      unitLabel: factor < 1 ? "cru" : "total",
      pricePerKg: item.food.pricePerKg,
    };
    current.plannedReadyGrams += item.grams * days;
    current.buyGrams += (item.grams / factor) * days;
    shopping.set(item.food.name, current);
  }));
  const estimatedCost = [...shopping.values()].reduce((total, item) => total + (item.pricePerKg ? (item.buyGrams / 1000) * item.pricePerKg : 0), 0);
  const totals = planMeals.flatMap((meal) => meal.items).reduce(
    (acc, item) => {
      const n = nutrientsForGrams({
        name: item.food.name,
        kcalPer100g: item.food.kcalPer100g,
        proteinPer100g: item.food.proteinPer100g,
        carbsPer100g: item.food.carbsPer100g,
        fatPer100g: item.food.fatPer100g,
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
  const planStatus = totals ? dietStatus(Math.round(totals.kcal), metrics.targets.calories) : null;

  return (
    <AppShell>
      <h1 className="text-4xl font-semibold tracking-tight">Montador de dieta</h1>
      <p className="mt-3 max-w-2xl text-zinc-400">Gere um plano inicial, edite gramas ou registre a dieta do nutricionista. O foco aqui é bater sua meta real do dia.</p>
      <div className="mt-8 grid items-start gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <GlassCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">{plan?.name ?? "Nenhum plano ativo"}</h2>
            <div className="flex flex-wrap gap-2">
              <form action={generateAiDietPlanAction} className="flex flex-wrap gap-2">
                <input name="monthlyBudget" inputMode="decimal" className="h-9 w-36 rounded-full bg-white/10 px-4 text-sm outline-none" placeholder="R$/mês" />
                <button className="rounded-full bg-lime-300 px-4 py-2 text-sm font-semibold text-black">Gerar com IA</button>
              </form>
              <form action={generateDietPlanAction}><button className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">Gerar básico</button></form>
            </div>
          </div>
          <form action={createManualDietPlanAction} className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-0 flex-1">
                <span className="text-sm text-zinc-400">Plano manual do nutricionista</span>
                <input
                  name="name"
                  className="mt-2 h-11 w-full rounded-2xl bg-white/10 px-4 text-sm outline-none"
                  placeholder="Ex: Dieta prescrita - fase 1"
                />
              </label>
              <button className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/10">
                <Plus size={16} />
                Criar manual
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Use quando o cliente já tem dieta do nutricionista. Depois adicione alimento e gramas em cada refeição.
            </p>
          </form>
          <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold">Opções de dieta</p>
                <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-500">
                  Crie variações do mesmo plano mudando a fonte principal de proteína. Ex: Dieta 1 com frango, Dieta 2 com tilápia ou patinho.
                </p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-400">{dietPlans.length} salvas</span>
            </div>

            {dietPlans.length ? (
              <div className="mt-4 grid gap-2 lg:grid-cols-2">
                {dietPlans.map((dietPlan, index) => {
                  const summary = planSummary(dietPlan.meals);
                  return (
                    <div key={dietPlan.id} className={`rounded-2xl border p-3 ${dietPlan.isActive ? "border-lime-300/35 bg-lime-300/10" : "border-white/10 bg-white/[0.04]"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold">{dietPlan.name || `Dieta ${index + 1}`}</p>
                            {dietPlan.isActive ? <span className="rounded-full bg-lime-300 px-2 py-0.5 text-[11px] font-semibold text-black">ativa</span> : null}
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            {Math.round(summary.kcal)} kcal · P {Math.round(summary.protein)}g C {Math.round(summary.carbs)}g G {Math.round(summary.fat)}g
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {!dietPlan.isActive ? (
                            <form action={setActiveDietPlanAction}>
                              <input type="hidden" name="planId" value={dietPlan.id} />
                              <button className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-white/15">Usar</button>
                            </form>
                          ) : null}
                          {dietPlans.length > 1 ? (
                            <form action={deleteDietPlanAction}>
                              <input type="hidden" name="planId" value={dietPlan.id} />
                              <button className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-zinc-400 transition hover:bg-red-500/20 hover:text-red-200" aria-label="Excluir dieta">
                                <Trash2 size={14} />
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">Crie ou gere uma dieta para salvar a primeira opção.</p>
            )}

            <form action={createProteinSwapDietPlanAction} className="mt-4 grid gap-2 border-t border-white/10 pt-4 lg:grid-cols-[1fr_1.2fr_auto]">
              <input name="variantName" className="h-11 rounded-2xl bg-white/10 px-4 text-sm outline-none" placeholder="Nome. Ex: Dieta 2 - tilápia" />
              <FoodSearchField
                foods={foods}
                className="h-11 w-full rounded-2xl bg-white/10 px-4 text-sm outline-none transition focus:ring-1 focus:ring-lime-300/50"
                placeholder="Nova proteína. Ex: tilápia, patinho, whey"
              />
              <button disabled={!plan} className="inline-flex h-11 items-center justify-center rounded-full bg-lime-300 px-5 text-sm font-semibold text-black transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40">
                Criar variação
              </button>
            </form>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              A troca preserva aproximadamente a proteína da refeição. Calorias e gordura podem mudar conforme o alimento escolhido.
            </p>
          </div>
          <form action={updateDietMealsAction} className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold">Refeições do plano</p>
                <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-500">
                  Marque só as refeições que você realmente faz. Se você treina 6h e não usa pré-treino, desmarque essa opção.
                </p>
              </div>
              <button disabled={!plan} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40">
                Salvar refeições
              </button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {mealChoices.map((mealName) => (
                <label key={mealName} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    name="mealNames"
                    value={mealName}
                    defaultChecked={!plan || activeMealNames.has(mealName)}
                    className="h-4 w-4 accent-lime-300"
                    disabled={!plan}
                  />
                  {mealName}
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              Ao remover uma refeição, os alimentos dela saem do plano ativo. Depois gere com IA novamente para redistribuir as calorias nas refeições escolhidas.
            </p>
          </form>
          {plan && totals && planStatus ? (
            <div className={`mt-5 rounded-3xl border p-4 ${planStatus.className}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-lime-200">Planejado vs meta</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">Use isso para saber se a dieta montada está perto do alvo que você escolheu.</p>
                </div>
                <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-semibold text-zinc-100">{planStatus.label}</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <DietTarget label="Calorias planejadas" value={`${Math.round(totals.kcal)} kcal`} detail={`meta ${metrics.targets.calories} kcal`} />
                <DietTarget label="Proteína" value={`${Math.round(totals.protein)} g`} detail={`meta ${metrics.targets.proteinG} g`} />
                <DietTarget label="Carboidrato" value={`${Math.round(totals.carbs)} g`} detail="restante das calorias" />
                <DietTarget label="Gordura" value={`${Math.round(totals.fat)} g`} detail={`meta ${metrics.targets.fatG} g`} />
              </div>
              <p className="mt-3 text-xs leading-5 text-zinc-400">
                Diferença: {planStatus.diffLabel}. Confira marcas, modo de preparo e gramas antes de seguir.
              </p>
            </div>
          ) : null}
          <div className="mt-5 space-y-3">
            {plan ? planMeals.map((meal) => (
              <div key={meal.id} className="rounded-3xl bg-white/[0.04] p-4">
                <p className="font-medium">{normalizeMealName(meal.name)}</p>
                <div className="mt-3 grid gap-2">
                  {meal.items.map((item) => {
                    const nutrients = nutrientsForGrams({
                      name: item.food.name,
                      kcalPer100g: item.food.kcalPer100g,
                      proteinPer100g: item.food.proteinPer100g,
                      carbsPer100g: item.food.carbsPer100g,
                      fatPer100g: item.food.fatPer100g,
                      fiberPer100g: item.food.fiberPer100g ?? 0,
                      sodiumPer100g: item.food.sodiumPer100g ?? 0,
                    }, item.grams);
                    return (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/25 px-3 py-2">
                        <span className="min-w-0 flex-1 text-sm text-zinc-200">{item.food.name} - {nutrients.kcal} kcal</span>
                        <form action={updateDietItemGramsAction} className="flex items-center gap-2">
                          <input type="hidden" name="itemId" value={item.id} />
                          <input name="grams" defaultValue={item.grams} className="h-9 w-24 rounded-xl bg-white/10 px-3 text-sm outline-none" />
                          <button className="rounded-full bg-white/10 px-3 py-2 text-xs">Salvar</button>
                        </form>
                        <form action={removeDietItemAction}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <button className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-zinc-300 transition hover:bg-red-500/20 hover:text-red-200" aria-label="Remover alimento">
                            <Trash2 size={15} />
                          </button>
                        </form>
                      </div>
                    );
                  })}
                  <form action={addManualDietItemAction} className="grid gap-2 rounded-2xl border border-dashed border-white/10 bg-black/20 p-3 md:grid-cols-[minmax(0,1fr)_110px_auto]">
                    <input type="hidden" name="mealId" value={meal.id} />
                    <FoodSearchField
                      foods={foods}
                      className="h-10 w-full rounded-xl bg-white/10 px-3 text-sm outline-none transition focus:ring-1 focus:ring-lime-300/50"
                      placeholder="Digite para buscar alimento"
                    />
                    <input name="grams" inputMode="decimal" className="h-10 rounded-xl bg-white/10 px-3 text-sm outline-none" placeholder="gramas" required />
                    <button className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-lime-300 px-4 text-sm font-semibold text-black">
                      <Plus size={15} />
                      Adicionar
                    </button>
                  </form>
                </div>
              </div>
            )) : <p className="text-sm text-zinc-500">Clique em gerar plano para criar uma dieta inicial com alimentos brasileiros comuns.</p>}
          </div>
        </GlassCard>
        <GlassCard className="lg:sticky lg:top-24">
          <ShoppingBag className="text-lime-300" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Lista de compras</h2>
              <p className="mt-1 text-sm text-zinc-500">{days === 30 ? "Mensal" : "Quinzenal"} - {days} dias</p>
            </div>
            <div className="flex rounded-full bg-white/10 p-1 text-sm">
              <Link href="/dieta?periodo=quinzenal" className={`rounded-full px-3 py-2 ${days === 15 ? "bg-lime-300 text-black" : "text-zinc-300"}`}>15 dias</Link>
              <Link href="/dieta?periodo=mensal" className={`rounded-full px-3 py-2 ${days === 30 ? "bg-lime-300 text-black" : "text-zinc-300"}`}>30 dias</Link>
            </div>
          </div>
          <div className="mt-5 grid gap-3 text-sm text-zinc-300">
            {[...shopping.entries()].map(([name, item]) => (
              <div key={name} className="rounded-2xl bg-black/25 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span>{name}</span>
                  <span className="font-medium text-zinc-100">{formatShoppingWeight(item.buyGrams)}</span>
                </div>
                {item.unitLabel === "cru" ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Comprar cru. O plano mostra {formatShoppingWeight(item.plannedReadyGrams)} já pronto para comer.
                  </p>
                ) : null}
                {item.pricePerKg ? <p className="mt-1 text-xs text-zinc-500">Estimado: R$ {((item.buyGrams / 1000) * item.pricePerKg).toFixed(2)}</p> : null}
              </div>
            ))}
            {!shopping.size ? <p className="text-zinc-500">Gere um plano para ver a lista.</p> : null}
            {estimatedCost > 0 ? (
              <div className="rounded-2xl border border-lime-300/20 bg-lime-300/10 px-4 py-3 text-lime-100">
                Custo estimado do período: R$ {estimatedCost.toFixed(2)}
              </div>
            ) : (
              shopping.size ? <p className="text-xs leading-5 text-zinc-500">Preencha preço por kg dos alimentos para estimar custo da lista.</p> : null
            )}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}

function cookingYieldFactor(name: string, category: string) {
  const normalized = `${name} ${category}`.toLowerCase();
  if (normalized.includes("peixe") || normalized.includes("tilapia") || normalized.includes("sardinha")) return 0.8;
  if (normalized.includes("carne") || normalized.includes("frango") || normalized.includes("patinho") || normalized.includes("grelhado") || normalized.includes("assado")) return 0.75;
  return 1;
}

function formatShoppingWeight(grams: number) {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2).replace(".", ",")} kg`;
  return `${Math.round(grams)} g`;
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

function DietTarget({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-black/25 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-100">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
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
  );
}

function uniqueMeals(meals: string[]) {
  return [...new Set(meals)];
}

function sortMeals<T extends { name: string; order: number }>(meals: T[]) {
  return [...meals].sort((a, b) => mealOrder(a.name) - mealOrder(b.name) || a.order - b.order);
}
