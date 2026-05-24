import { BookOpen, Plus, Trash2, Utensils } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/profile";
import { nutrientsForGrams } from "@/lib/nutrition";
import {
  addRecipePortionToDiaryAction,
  addRecipePortionToPlanAction,
  createRecipeAction,
  deleteRecipeAction,
} from "./actions";

export default async function ReceitasPage() {
  const { user } = await requireUserProfile();
  const foods = await prisma.food.findMany({
    where: { OR: [{ createdByUserId: null }, { createdByUserId: user.id }] },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true },
  });
  const recipes = await prisma.recipe.findMany({
    where: { OR: [{ userId: user.id }, { userId: null }] },
    include: { items: { include: { food: true } } },
    orderBy: { createdAt: "desc" },
  });
  const activePlan = await prisma.dietPlan.findFirst({
    where: { userId: user.id, isActive: true },
    include: { meals: { orderBy: { order: "asc" }, select: { id: true, name: true } } },
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-lime-300">Receitas</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Minhas receitas</h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Monte receitas com alimentos da TACO, calcule calorias e nutrientes por porção e lance no diário ou no plano alimentar.
          </p>
        </div>
        <div className="rounded-3xl bg-white/10 px-5 py-4 text-right">
          <p className="text-2xl font-semibold">{recipes.length}</p>
          <p className="text-xs text-zinc-500">receitas salvas</p>
        </div>
      </div>

      <GlassCard className="mt-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-300/15 text-lime-300">
            <Utensils size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Nova receita</h2>
            <p className="text-sm text-zinc-500">Digite o alimento e escolha uma sugestão da base TACO ou dos seus alimentos.</p>
          </div>
        </div>
        <form action={createRecipeAction} className="mt-6 grid gap-4">
          <div className="grid gap-3 md:grid-cols-[1fr_150px]">
            <input name="name" className={inputClass} placeholder="Nome da receita" required />
            <input name="servings" type="number" min="1" className={inputClass} placeholder="Porções" required />
          </div>
          <div className="grid gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-[1fr_140px]">
                <input
                  name={`foodQuery${index}`}
                  list="recipe-food-options"
                  className={inputClass}
                  placeholder={index === 0 ? "Ingrediente principal, ex: patinho" : `Ingrediente ${index + 1} opcional`}
                  required={index === 0}
                />
                <input
                  name={`grams${index}`}
                  inputMode="decimal"
                  className={inputClass}
                  placeholder="gramas"
                  required={index === 0}
                />
              </div>
            ))}
          </div>
          <textarea
            name="instructions"
            className="min-h-24 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-lime-300/50"
            placeholder="Modo de preparo opcional"
          />
          <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lime-300 px-5 font-semibold text-black transition hover:bg-lime-200">
            <Plus size={18} />
            Salvar receita
          </button>
        </form>
        <datalist id="recipe-food-options">
          {foods.map((food) => (
            <option key={food.id} value={food.name} label={food.category} />
          ))}
        </datalist>
      </GlassCard>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {recipes.map((recipe) => {
          const totals = recipe.items.reduce((acc, item) => {
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
              fiber: acc.fiber + (n.fiberG ?? 0),
            };
          }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
          const perServing = {
            kcal: totals.kcal / recipe.servings,
            protein: totals.protein / recipe.servings,
            carbs: totals.carbs / recipe.servings,
            fat: totals.fat / recipe.servings,
            fiber: totals.fiber / recipe.servings,
          };

          return (
            <GlassCard key={recipe.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold">{recipe.name}</p>
                  <p className="mt-1 text-sm text-zinc-500">{recipe.servings} porções - {Math.round(totals.kcal)} kcal na receita inteira</p>
                </div>
                {recipe.userId === user.id ? (
                  <form action={deleteRecipeAction}>
                    <input type="hidden" name="recipeId" value={recipe.id} />
                    <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-zinc-300 transition hover:bg-red-500/20 hover:text-red-200" aria-label="Excluir receita">
                      <Trash2 size={16} />
                    </button>
                  </form>
                ) : null}
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-5">
                <Macro label="kcal" value={Math.round(perServing.kcal)} />
                <Macro label="prot" value={`${round(perServing.protein)}g`} />
                <Macro label="carbo" value={`${round(perServing.carbs)}g`} />
                <Macro label="gord" value={`${round(perServing.fat)}g`} />
                <Macro label="fibra" value={`${round(perServing.fiber)}g`} />
              </div>

              <div className="mt-5 grid gap-2">
                {recipe.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-black/25 px-4 py-3 text-sm">
                    <span className="text-zinc-200">{item.food.name}</span>
                    <span className="text-zinc-500">{round(item.grams)}g</span>
                  </div>
                ))}
              </div>

              {recipe.instructions ? (
                <p className="mt-4 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm leading-6 text-zinc-400">{recipe.instructions}</p>
              ) : null}

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <form action={addRecipePortionToDiaryAction} className="rounded-3xl bg-black/25 p-3">
                  <input type="hidden" name="recipeId" value={recipe.id} />
                  <div className="grid gap-2 sm:grid-cols-[80px_1fr_auto]">
                    <input name="portions" defaultValue="1" inputMode="decimal" className="h-10 rounded-2xl bg-white/10 px-3 text-sm outline-none" />
                    <select name="mealName" className="h-10 rounded-2xl bg-white/10 px-3 text-sm outline-none">
                      {["Café da manhã", "Almoço", "Pré-treino", "Jantar", "Ceia"].map((meal) => <option key={meal}>{meal}</option>)}
                    </select>
                    <button className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-lime-300 px-4 text-sm font-semibold text-black">
                      <Plus size={15} />
                      Diário
                    </button>
                  </div>
                </form>

                {activePlan ? (
                  <form action={addRecipePortionToPlanAction} className="rounded-3xl bg-black/25 p-3">
                    <input type="hidden" name="recipeId" value={recipe.id} />
                    <div className="grid gap-2 sm:grid-cols-[80px_1fr_auto]">
                      <input name="portions" defaultValue="1" inputMode="decimal" className="h-10 rounded-2xl bg-white/10 px-3 text-sm outline-none" />
                      <select name="mealId" className="h-10 rounded-2xl bg-white/10 px-3 text-sm outline-none">
                        {activePlan.meals.map((meal) => <option key={meal.id} value={meal.id}>{meal.name}</option>)}
                      </select>
                      <button className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold text-white">
                        <BookOpen size={15} />
                        Plano
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            </GlassCard>
          );
        })}
        {!recipes.length ? (
          <GlassCard>
            <p className="text-zinc-300">Salve sua primeira receita para usar no diário e no plano alimentar.</p>
          </GlassCard>
        ) : null}
      </div>
    </AppShell>
  );
}

const inputClass = "h-12 rounded-2xl border border-white/10 bg-black/30 px-4 outline-none transition focus:border-lime-300/50";

function Macro({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-black/25 px-3 py-2">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
