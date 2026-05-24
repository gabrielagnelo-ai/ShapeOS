import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics, endOfToday, requireUserProfile, startOfToday } from "@/lib/profile";
import { macroProgress, sumNutrients } from "@/lib/nutrition";
import { addFoodLogAction, deleteFoodLogItemAction } from "./actions";

export default async function DiarioPage() {
  const { user, profile } = await requireUserProfile();
  const metrics = computeProfileMetrics(profile);
  const foods = await prisma.food.findMany({ orderBy: { name: "asc" }, take: 100 });
  const log = await prisma.foodLog.findFirst({
    where: { userId: user.id, date: { gte: startOfToday(), lte: endOfToday() } },
    include: { items: { include: { food: true }, orderBy: { id: "desc" } } },
  });

  const consumed = sumNutrients(
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
    ["Cálcio", consumed.calciumMg, metrics.micronutrientTargets.calciumMg, "mg"],
    ["Ferro", consumed.ironMg, metrics.micronutrientTargets.ironMg, "mg"],
    ["Magnesio", consumed.magnesiumMg, metrics.micronutrientTargets.magnesiumMg, "mg"],
    ["Potassio", consumed.potassiumMg, metrics.micronutrientTargets.potassiumMg, "mg"],
    ["Zinco", consumed.zincMg, metrics.micronutrientTargets.zincMg, "mg"],
    ["Vitamina C", consumed.vitaminCMg, metrics.micronutrientTargets.vitaminCMg, "mg"],
    ["Vitamina D", consumed.vitaminDMcg, metrics.micronutrientTargets.vitaminDMcg, "mcg"],
    ["B12", consumed.vitaminB12Mcg, metrics.micronutrientTargets.vitaminB12Mcg, "mcg"],
  ] as const;

  return (
    <AppShell>
      <h1 className="text-4xl font-semibold tracking-tight">Diário alimentar</h1>
      <p className="mt-3 text-zinc-400">Registro real vs meta diária de kcal, macros, fibra e sódio.</p>
      <div className="mt-8 grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
        <GlassCard>
          <h2 className="text-xl font-semibold">Registrar alimento</h2>
          <form action={addFoodLogAction} className="mt-5 grid gap-3">
            <select name="foodId" className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 outline-none" required>
              <option value="">Selecione um alimento</option>
              {foods.map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}
            </select>
            <input name="grams" inputMode="decimal" className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 outline-none" placeholder="Gramas. Ex: 150" required />
            <select name="mealName" className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 outline-none">
              {["Café da manhã", "Almoço", "Pré-treino", "Jantar", "Ceia"].map((meal) => <option key={meal}>{meal}</option>)}
            </select>
            <button className="rounded-full bg-lime-300 px-5 py-3 font-semibold text-black">Adicionar ao dia</button>
          </form>
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
      <GlassCard className="mt-4">
        <h2 className="text-xl font-semibold">Micronutrientes</h2>
        <p className="mt-2 text-sm text-zinc-500">Metas sugeridas automaticamente. Valores aparecem conforme a base de alimentos tiver dados.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {microBars.map(([label, value, target, unit]) => {
            const pct = target ? Math.round((value / target) * 100) : 0;
            return (
              <div key={label}>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="text-zinc-500">{value.toFixed(1)} / {target} {unit}</span>
                </div>
                <div className="h-3 rounded-full bg-white/10"><div className="h-3 rounded-full bg-sky-300" style={{ width: `${Math.min(100, pct)}%` }} /></div>
              </div>
            );
          })}
        </div>
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
