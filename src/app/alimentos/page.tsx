import { Ban, BookOpen, Plus, Search, Star } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/profile";
import { nutrientsForGrams } from "@/lib/nutrition";
import {
  addFoodFromLibraryToDiaryAction,
  addFoodFromLibraryToPlanAction,
  createCustomFoodAction,
  toggleBlockedFoodAction,
  toggleFavoriteFoodAction,
} from "./actions";

type SearchParams = Promise<{
  q?: string;
  categoria?: string;
  gramas?: string;
  favoritos?: string;
  bloqueados?: string;
}>;

export default async function AlimentosPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { user } = await requireUserProfile();
  const query = String(params.q ?? "").trim();
  const category = String(params.categoria ?? "").trim();
  const grams = parseGrams(params.gramas) ?? 100;
  const onlyFavorites = params.favoritos === "1";
  const onlyBlocked = params.bloqueados === "1";

  const categories = await prisma.food.findMany({
    distinct: ["category"],
    orderBy: { category: "asc" },
    select: { category: true },
  });
  const preferences = await prisma.foodPreference.findMany({ where: { userId: user.id } });
  const preferenceByFood = new Map(preferences.map((preference) => [preference.foodId, preference]));
  const favoriteIds = preferences.filter((preference) => preference.isFavorite).map((preference) => preference.foodId);
  const blockedIds = preferences.filter((preference) => preference.isBlocked).map((preference) => preference.foodId);

  const foods = await prisma.food.findMany({
    where: {
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
      ...(category ? { category } : {}),
      ...(onlyFavorites ? { id: { in: favoriteIds.length ? favoriteIds : ["__none__"] } } : {}),
      ...(onlyBlocked ? { id: { in: blockedIds.length ? blockedIds : ["__none__"] } } : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    take: 80,
  });
  const activePlan = await prisma.dietPlan.findFirst({
    where: { userId: user.id, isActive: true },
    include: { meals: { orderBy: { order: "asc" }, select: { id: true, name: true } } },
  });

  const totalFoods = await prisma.food.count();
  const tacoFoods = await prisma.food.count({ where: { source: "TACO 4a edicao" } });
  const communityFoods = await prisma.food.count({ where: { source: "Usuário" } });

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-lime-300">Biblioteca</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Alimentos</h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Consulte a TACO, calcule por gramas, favorite, bloqueie para a IA e adicione direto no diário ou no plano.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <Metric label="base" value={totalFoods} />
          <Metric label="TACO" value={tacoFoods} />
          <Metric label="usuários" value={communityFoods} />
        </div>
      </div>

      <GlassCard className="mt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Adicionar alimento manual</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Use para alimentos que não existem na TACO. Os valores devem ser por 100g, como no rótulo ou na tabela que você usa.
            </p>
          </div>
          <span className="rounded-full bg-lime-300/15 px-3 py-1 text-xs font-semibold text-lime-200">disponível para todos</span>
        </div>
        <form action={createCustomFoodAction} className="mt-5 grid gap-3">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <input name="name" className={inputClass} placeholder="Nome do alimento. Ex: Pão francês da padaria" required />
            <input name="category" className={inputClass} placeholder="Categoria. Ex: Pães" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            <input name="kcalPer100g" inputMode="decimal" className={inputClass} placeholder="kcal/100g" />
            <input name="proteinPer100g" inputMode="decimal" className={inputClass} placeholder="proteína" required />
            <input name="carbsPer100g" inputMode="decimal" className={inputClass} placeholder="carbo" required />
            <input name="fatPer100g" inputMode="decimal" className={inputClass} placeholder="gordura" required />
            <input name="fiberPer100g" inputMode="decimal" className={inputClass} placeholder="fibra" />
            <input name="sodiumPer100g" inputMode="decimal" className={inputClass} placeholder="sódio mg" />
            <input name="pricePerKg" inputMode="decimal" className={inputClass} placeholder="R$/kg" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-5 text-zinc-500">
              Se kcal ficar vazio, o app calcula por macros: proteína 4 kcal/g, carbo 4 kcal/g e gordura 9 kcal/g.
            </p>
            <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lime-300 px-5 font-semibold text-black transition hover:bg-lime-200">
              <Plus size={17} />
              Salvar alimento
            </button>
          </div>
        </form>
      </GlassCard>

      <GlassCard className="mt-5">
        <form className="grid gap-3 lg:grid-cols-[1fr_220px_130px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              name="q"
              defaultValue={query}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 pl-11 pr-4 text-white outline-none transition focus:border-lime-300/50"
              placeholder="Buscar alimento, ex: arroz, patinho, banana"
            />
          </label>
          <select
            name="categoria"
            defaultValue={category}
            className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none transition focus:border-lime-300/50"
          >
            <option value="">Todas categorias</option>
            {categories.map((item) => (
              <option key={item.category} value={item.category}>{item.category}</option>
            ))}
          </select>
          <input
            name="gramas"
            defaultValue={grams}
            inputMode="decimal"
            className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none transition focus:border-lime-300/50"
            placeholder="gramas"
          />
          <button className="h-12 rounded-full bg-lime-300 px-6 font-semibold text-black transition hover:bg-lime-200">
            Buscar
          </button>
          <div className="flex flex-wrap gap-2 lg:col-span-4">
            <FilterChip href={buildHref({ ...params, favoritos: onlyFavorites ? undefined : "1", bloqueados: undefined })} active={onlyFavorites}>
              Favoritos
            </FilterChip>
            <FilterChip href={buildHref({ ...params, bloqueados: onlyBlocked ? undefined : "1", favoritos: undefined })} active={onlyBlocked}>
              Bloqueados
            </FilterChip>
            <FilterChip href="/alimentos" active={!query && !category && !onlyFavorites && !onlyBlocked && grams === 100}>
              Limpar
            </FilterChip>
          </div>
        </form>
      </GlassCard>

      <div className="mt-5 grid gap-3">
        {foods.map((food) => {
          const preference = preferenceByFood.get(food.id);
          const nutrients = nutrientsForGrams({
            name: food.name,
            kcalPer100g: food.kcalPer100g,
            proteinPer100g: food.proteinPer100g,
            carbsPer100g: food.carbsPer100g,
            fatPer100g: food.fatPer100g,
            fiberPer100g: food.fiberPer100g ?? 0,
            sodiumPer100g: food.sodiumPer100g ?? 0,
          }, grams);
          const proteinDensity = food.kcalPer100g > 0 ? (food.proteinPer100g * 4) / food.kcalPer100g : 0;
          const tags = [
            proteinDensity >= 0.3 ? "boa proteína" : null,
            (food.fiberPer100g ?? 0) >= 3 ? "fibra" : null,
            food.kcalPer100g <= 80 ? "baixo kcal" : null,
            preference?.isBlocked ? "bloqueado" : null,
          ].filter(Boolean);

          return (
            <GlassCard key={food.id} className="p-5">
              <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-zinc-100">{food.name}</p>
                      <p className="mt-1 text-sm text-zinc-500">{food.category} - {food.source}</p>
                    </div>
                    <div className="flex gap-2">
                      <IconForm action={toggleFavoriteFoodAction} foodId={food.id} active={Boolean(preference?.isFavorite)} label="Favoritar">
                        <Star size={16} fill={preference?.isFavorite ? "currentColor" : "none"} />
                      </IconForm>
                      <IconForm action={toggleBlockedFoodAction} foodId={food.id} active={Boolean(preference?.isBlocked)} label="Bloquear para IA">
                        <Ban size={16} />
                      </IconForm>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-5">
                    <Nutrient label={`${grams}g`} value={`${nutrients.kcal} kcal`} />
                    <Nutrient label="proteína" value={`${round(nutrients.proteinG)}g`} />
                    <Nutrient label="carbo" value={`${round(nutrients.carbsG)}g`} />
                    <Nutrient label="gordura" value={`${round(nutrients.fatG)}g`} />
                    <Nutrient label="fibra" value={`${round(nutrients.fiberG ?? 0)}g`} />
                  </div>
                  {tags.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300">{tag}</span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="grid content-start gap-3">
                  <form action={addFoodFromLibraryToDiaryAction} className="rounded-3xl bg-black/25 p-3">
                    <input type="hidden" name="foodId" value={food.id} />
                    <input type="hidden" name="grams" value={grams} />
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
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
                    <form action={addFoodFromLibraryToPlanAction} className="rounded-3xl bg-black/25 p-3">
                      <input type="hidden" name="foodId" value={food.id} />
                      <input type="hidden" name="grams" value={grams} />
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
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
              </div>
            </GlassCard>
          );
        })}
        {!foods.length ? (
          <GlassCard>
            <p className="text-zinc-300">Nenhum alimento encontrado. Tente outro termo ou limpe os filtros.</p>
          </GlassCard>
        ) : null}
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3">
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function Nutrient({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/25 px-3 py-2">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function IconForm({
  action,
  foodId,
  active,
  label,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  foodId: string;
  active: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="foodId" value={foodId} />
      <button
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition ${active ? "bg-lime-300 text-black" : "bg-white/10 text-zinc-300 hover:bg-white/15"}`}
        aria-label={label}
        title={label}
      >
        {children}
      </button>
    </form>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a className={`rounded-full px-4 py-2 text-sm transition ${active ? "bg-lime-300 text-black" : "bg-white/10 text-zinc-300 hover:bg-white/15"}`} href={href}>
      {children}
    </a>
  );
}

function parseGrams(value?: string) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const inputClass = "h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none transition focus:border-lime-300/50";

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function buildHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return query ? `/alimentos?${query}` : "/alimentos";
}
