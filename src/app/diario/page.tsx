import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { FoodSearchField } from "@/components/food/food-search-field";
import Link from "next/link";
import { Check, Pill, Trash2 } from "lucide-react";
import { appDateInputValue } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics, endOfToday, requireUserProfile, startOfToday } from "@/lib/profile";
import { macroProgress, sumNutrients } from "@/lib/nutrition";
import { sumSupplementMicronutrients, supplementDoseUnit } from "@/lib/supplements";
import { addFoodLogAction, deleteFoodLogItemAction } from "./actions";
import { deleteSupplementLogAction, logSupplementDoseAction } from "@/app/suplementos/actions";

export default async function DiarioPage() {
  const { user, profile } = await requireUserProfile();
  const metrics = computeProfileMetrics(profile);
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const [foods, log, multivitamins] = await Promise.all([
    prisma.food.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true },
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
    ["B12", "vitaminB12Mcg", metrics.micronutrientTargets.vitaminB12Mcg, "mcg"],
  ] as const;
  const hasMicronutrientData = Boolean(log?.items.length || multivitamins.some((plan) => plan.logs.length));
  const today = appDateInputValue();

  return (
    <AppShell>
      <h1 className="text-4xl font-semibold tracking-tight">Diário alimentar</h1>
      <p className="mt-3 text-zinc-400">Registro real vs meta diária de calorias, proteínas, carboidratos, gorduras, fibra e sódio.</p>
      <div className="mt-8 grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
        <GlassCard>
          <h2 className="text-xl font-semibold">Registrar alimento</h2>
          <form action={addFoodLogAction} className="mt-5 grid gap-3">
            <FoodSearchField foods={foods} />
            <input name="grams" inputMode="decimal" className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 outline-none" placeholder="Gramas. Ex: 150" required />
            <select name="mealName" className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 outline-none">
              {["Café da manhã", "Almoço", "Pré-treino", "Jantar", "Ceia"].map((meal) => <option key={meal}>{meal}</option>)}
            </select>
            <button className="rounded-full bg-lime-300 px-5 py-3 font-semibold text-black">Adicionar ao dia</button>
          </form>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            A busca funciona como um Ctrl+F: digite parte do nome e confirme as gramas.
          </p>
        </GlassCard>
        <GlassCard>
          <h2 className="text-xl font-semibold">Progresso de hoje</h2>
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
              <p className="mt-1 text-sm leading-6 text-zinc-500">Confirme a dose tomada para somar os valores do rótulo aos micronutrientes de hoje.</p>
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
        <p className="mt-2 text-sm text-zinc-500">Total consumido hoje, separando o que veio dos alimentos e do multivitamínico registrado.</p>
        {hasMicronutrientData ? (
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
            <div key={item.id} className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3">
              <div>
                <p className="font-medium">{item.food.name}</p>
                <p className="text-sm text-zinc-500">{item.mealName} - {item.grams} g</p>
              </div>
              <form action={deleteFoodLogItemAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <button className="rounded-full bg-white/10 px-3 py-2 text-sm">Remover</button>
              </form>
            </div>
          )) : <p className="text-sm text-zinc-500">Nenhum alimento registrado hoje.</p>}
        </div>
      </GlassCard>
    </AppShell>
  );
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
