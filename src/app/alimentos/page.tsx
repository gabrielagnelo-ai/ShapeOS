import { PageHeading } from "@/components/ui/page-heading";
import { Hero, Section, Stack } from "@/components/ui/screen";
import { Ban, BookOpen, Plus, Search, Star } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/profile";
import { nutrientsForGrams, toFoodNutrients } from "@/lib/nutrition";
import { isWholeChickenEgg, wholeEggUnitPrice } from "@/lib/shopping-list";
import {
  addFoodFromLibraryToDiaryAction,
  addFoodFromLibraryToPlanAction,
  createCustomFoodAction,
  toggleBlockedFoodAction,
  toggleFavoriteFoodAction,
  updateFoodLabelAndPriceAction,
} from "./actions";
import { round1 } from "@/lib/common";

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
    take: 40,
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
      <PageHeading title="Alimentos" description="Consulte nutrientes, salve favoritos e adicione alimentos ao diário ou à dieta."><span>{totalFoods} alimentos · {tacoFoods} TACO · {communityFoods} da comunidade</span></PageHeading>

      <Stack>
        <Hero aria-label="Buscar alimentos">
        <form className="grid gap-3 lg:grid-cols-[1fr_220px_130px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              name="q"
              defaultValue={query}
              className="h-12 w-full rounded-[14px] bg-fill pl-11 pr-4 outline-none"
              placeholder="Buscar alimento, ex: arroz, patinho, banana"
            />
          </label>
          <select
            name="categoria"
            defaultValue={category}
            className="h-12 rounded-[14px] bg-fill px-4 outline-none"
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
            className="h-12 rounded-[14px] bg-fill px-4 outline-none"
            placeholder="gramas"
          />
          <button className="min-h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary-light px-6 font-semibold">
            Buscar
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 lg:col-span-4">
            <div className="flex flex-wrap gap-2">
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
            <p className="text-xs text-text-muted">Mostrando até 40 resultados.</p>
          </div>
        </form>
        </Hero>
        <Section title="Resultados">
        {foods.map((food) => {
          const usesUnitPrice = isWholeChickenEgg({ foodId: food.id, name: food.name });
          const preference = preferenceByFood.get(food.id);
          const nutrients = nutrientsForGrams(toFoodNutrients(food), grams);
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
                      <p className="text-lg font-semibold text-text-primary">{food.name}</p>
                      <p className="mt-1 text-sm text-text-muted">
                        {food.category} - {food.source}
                        {food.pricePerKg ? ` - R$ ${formatCurrency(usesUnitPrice ? wholeEggUnitPrice(food.pricePerKg) : food.pricePerKg)}/${usesUnitPrice ? "unidade" : "kg"}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <IconForm action={toggleFavoriteFoodAction} foodId={food.id} active={Boolean(preference?.isFavorite)} label="Favoritar">
                        <Star size={16} fill={preference?.isFavorite ? "currentColor" : "none"} />
                      </IconForm>
                      <IconForm action={toggleBlockedFoodAction} foodId={food.id} active={Boolean(preference?.isBlocked)} label="Marcar como alimento a evitar">
                        <Ban size={16} />
                      </IconForm>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-5">
                    <Nutrient label={`${grams}g`} value={`${nutrients.kcal} kcal`} />
                    <Nutrient label="proteína" value={`${round1(nutrients.proteinG)}g`} />
                    <Nutrient label="carbo" value={`${round1(nutrients.carbsG)}g`} />
                    <Nutrient label="gordura" value={`${round1(nutrients.fatG)}g`} />
                    <Nutrient label="fibra" value={`${round1(nutrients.fiberG ?? 0)}g`} />
                  </div>
                  {tags.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs text-text-secondary">{tag}</span>
                      ))}
                    </div>
                  ) : null}
                  <details className="mt-4 border-t border-hairline pt-3">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-text-secondary">
                      Editar nome e preço
                    </summary>
                    <form action={updateFoodLabelAndPriceAction} className="mt-3 grid gap-2 md:grid-cols-[1fr_140px_auto]">
                      <input type="hidden" name="foodId" value={food.id} />
                      <input
                        name="name"
                        defaultValue={food.name}
                        className="h-10 rounded-[14px] bg-fill px-3 text-sm outline-none"
                        placeholder="Nome do alimento"
                        required
                      />
                      <input
                        name={usesUnitPrice ? "pricePerUnit" : "pricePerKg"}
                        defaultValue={food.pricePerKg == null ? "" : usesUnitPrice ? wholeEggUnitPrice(food.pricePerKg).toFixed(2) : food.pricePerKg}
                        inputMode="decimal"
                        className="h-10 rounded-[14px] bg-fill px-3 text-sm outline-none"
                        placeholder={usesUnitPrice ? "R$/unidade" : "R$/kg"}
                      />
                      <button className="h-10 rounded-full bg-fill px-4 text-sm font-semibold text-text-primary transition hover:bg-fill-strong">
                        Salvar
                      </button>
                    </form>
                    <p className="mt-2 text-xs leading-5 text-text-muted">
                      Isso não altera calorias, macros, micronutrientes ou registros antigos. O mesmo alimento continua vinculado pelo ID.
                    </p>
                  </details>
                </div>

                <div className="grid content-start gap-3">
                  <form action={addFoodFromLibraryToDiaryAction} className="rounded-[14px] bg-surface-tertiary p-3">
                    <input type="hidden" name="foodId" value={food.id} />
                    <input type="hidden" name="grams" value={grams} />
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <select name="mealName" className="h-10 rounded-2xl bg-white/10 px-3 text-sm outline-none">
                        {["Café da manhã", "Almoço", "Pré-treino", "Jantar", "Ceia"].map((meal) => <option key={meal}>{meal}</option>)}
                      </select>
                      <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-primary/15 text-primary hover:bg-primary/20 px-4 text-sm font-semibold">
                        <Plus size={15} />
                        Diário
                      </button>
                    </div>
                  </form>
                  {activePlan ? (
                    <form action={addFoodFromLibraryToPlanAction} className="rounded-[14px] bg-surface-tertiary p-3">
                      <input type="hidden" name="foodId" value={food.id} />
                      <input type="hidden" name="grams" value={grams} />
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <select name="mealId" className="h-10 rounded-2xl bg-white/10 px-3 text-sm outline-none">
                          {activePlan.meals.map((meal) => <option key={meal.id} value={meal.id}>{meal.name}</option>)}
                        </select>
                        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-fill px-4 text-sm font-semibold text-text-primary hover:bg-fill-strong">
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
            <p className="text-text-secondary">Nenhum alimento encontrado. Tente outro termo ou limpe os filtros.</p>
          </GlassCard>
        ) : null}
        </Section>
        <Section title="Adicionar alimento">
        <details className="panel p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Adicionar alimento manual</h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">Cadastre alimentos que não estão na base. Eles ficam disponíveis para todos.</p>
          </div>
          <span className="rounded-full bg-primary/15 text-primary hover:bg-primary/20 px-4 py-2 text-sm font-semibold">Abrir</span>
        </summary>
        <form action={createCustomFoodAction} className="mt-5 grid gap-3 border-t border-hairline pt-5">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <label className="grid min-w-0 gap-2 text-sm text-text-secondary">Nome do alimento<input name="name" className={inputClass} placeholder="Nome do alimento. Ex: Pão francês da padaria" required /></label>
            <label className="grid min-w-0 gap-2 text-sm text-text-secondary">Categoria<input name="category" className={inputClass} placeholder="Categoria. Ex: Pães" /></label>
          </div>
          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <select name="nutritionBase" className={inputClass} defaultValue="per100g">
              <option value="per100g">Valores por 100g</option>
              <option value="perServing">Valores por porção</option>
            </select>
            <label className="grid min-w-0 gap-2 text-sm text-text-secondary">Porção em gramas<input name="servingGrams" inputMode="decimal" className={inputClass} placeholder="Peso da porção em g. Ex: 60 para barrinha" /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
            <label className="grid min-w-0 gap-2 text-sm text-text-secondary">Calorias (kcal)<input name="kcalPer100g" inputMode="decimal" className={inputClass} placeholder="kcal" /></label>
            <label className="grid min-w-0 gap-2 text-sm text-text-secondary">Proteína (g)<input name="proteinPer100g" inputMode="decimal" className={inputClass} placeholder="proteína g" required /></label>
            <label className="grid min-w-0 gap-2 text-sm text-text-secondary">Carboidrato (g)<input name="carbsPer100g" inputMode="decimal" className={inputClass} placeholder="carbo g" required /></label>
            <label className="grid min-w-0 gap-2 text-sm text-text-secondary">Gordura (g)<input name="fatPer100g" inputMode="decimal" className={inputClass} placeholder="gordura g" required /></label>
            <label className="grid min-w-0 gap-2 text-sm text-text-secondary">Fibra (g)<input name="fiberPer100g" inputMode="decimal" className={inputClass} placeholder="fibra g" /></label>
            <label className="grid min-w-0 gap-2 text-sm text-text-secondary">Sódio (mg)<input name="sodiumPer100g" inputMode="decimal" className={inputClass} placeholder="sódio mg" /></label>
            <label className="grid min-w-0 gap-2 text-sm text-text-secondary">Preço por kg (R$)<input name="pricePerKg" inputMode="decimal" className={inputClass} placeholder="R$/kg" /></label>
            <label className="grid min-w-0 gap-2 text-sm text-text-secondary">Preço por unidade (R$)<input name="pricePerUnit" inputMode="decimal" className={inputClass} placeholder="R$/unidade (ovos)" /></label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-5 text-text-muted">
              Para barrinha, selecione valores por porção, informe 60g e copie o rótulo. O app converte para 100g internamente. Se kcal ficar vazio, calcula por macros.
            </p>
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary/15 text-primary hover:bg-primary/20 px-5 font-semibold">
              <Plus size={17} />
              Salvar alimento
            </button>
          </div>
        </form>
      </details>
        </Section>
      </Stack>
    </AppShell>
  );
}

function Nutrient({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-tertiary px-3 py-2">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 font-semibold text-text-primary">{value}</p>
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
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition ${active ? "bg-primary/15 text-primary hover:bg-primary/20" : "bg-fill text-text-primary hover:bg-fill-strong"}`}
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
    <a className={`inline-flex min-h-9 items-center rounded-full px-4 text-sm ${active ? "bg-[var(--glass-selected)] font-semibold text-text-primary shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)]" : "bg-fill text-text-secondary hover:text-text-primary"}`} href={href} aria-current={active ? "true" : undefined}>
      {children}
    </a>
  );
}

function parseGrams(value?: string) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const inputClass = "h-12 rounded-[14px] bg-fill px-4 outline-none";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return query ? `/alimentos?${query}` : "/alimentos";
}
