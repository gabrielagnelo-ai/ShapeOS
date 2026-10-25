import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import { PageHeading } from "@/components/ui/page-heading";
import { Stack } from "@/components/ui/screen";
import { ReliabilityNotice, SafetyReview } from "@/components/diet/reliability-notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { dietaryReviewIssue } from "@/lib/food-reliability";
import { BookOpen, ChevronDown, Pencil, Plus, Save, Trash2, Utensils } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { RecipeIngredientFields } from "@/components/recipes/recipe-ingredient-fields";
import { GlassCard } from "@/components/ui/glass-card";
import { mealOrder } from "@/lib/meals";
import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/profile";
import { nutrientsForGrams, toFoodNutrients } from "@/lib/nutrition";
import {
  addRecipePortionToDiaryAction,
  addRecipePortionToPlanAction,
  createRecipeAction,
  deleteRecipeAction,
  updateRecipeAction,
} from "./actions";
import styles from "./recipes.module.css";
import { round1 } from "@/lib/common";

export default async function ReceitasPage({ searchParams }: { searchParams: Promise<{ recipeStatus?: string }> }) {
  const { recipeStatus } = await searchParams;
  const { user, profile } = await requireUserProfile();
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
  const activePlanMeals = activePlan ? [...activePlan.meals].sort((a, b) => mealOrder(a.name) - mealOrder(b.name)) : [];

  const editor = (      <GlassCard className={styles.editor}>
        <div className="flex items-center gap-3">
          <div className="icon-tile [--tile:#ff9500]">
            <Utensils size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Nova receita</h2>
            <p className="text-sm text-text-muted">Digite o alimento e escolha uma sugestão da base TACO ou dos seus alimentos.</p>
          </div>
        </div>
        <form action={createRecipeAction} className={styles.createForm}>
          <div className={styles.metadataFields}>
            <label className={styles.field}>Nome da receita<input name="name" className={inputClass} placeholder="Ex.: Panqueca de aveia" required /></label>
            <label className={styles.field}>Porções<input name="servings" type="number" min="1" className={inputClass} placeholder="Ex.: 4" required /></label>
          </div>
          <RecipeIngredientFields foods={foods} />
          <label className={styles.field}><span>Modo de preparo <span className={styles.optional}>(opcional)</span></span><textarea
            name="instructions"
            className="min-h-24 rounded-[14px] bg-fill px-4 py-3 outline-none"
            placeholder="Descreva como preparar a receita"
          /></label>
          <SubmitButton className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground hover:bg-primary-light px-5 font-semibold">
            <Plus size={18} />
            Salvar receita
          </SubmitButton>
        </form>
      </GlassCard>);
  const library = (      <div className={styles.library}>
        {recipes.map((recipe) => {
          const totals = recipe.items.reduce((acc, item) => {
            const n = nutrientsForGrams(toFoodNutrients(item.food), item.grams);
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
            <GlassCard key={recipe.id} className={styles.card}>
              <header className={styles.header}>
                <h2>{recipe.name}</h2>
                <p>Rende {recipe.servings} {recipe.servings === 1 ? "porção" : "porções"} · {Math.round(totals.kcal).toLocaleString("pt-BR")} kcal no total</p>
              </header>

              <section className={styles.nutrition} aria-label={`Nutrientes por porção de ${recipe.name}`}>
                <p>Por porção</p>
                <dl className={styles.nutrients}>
                  <Macro label="Calorias" value={`${Math.round(perServing.kcal).toLocaleString("pt-BR")} kcal`} />
                  <Macro label="Proteína" value={`${round1(perServing.protein)} g`} />
                  <Macro label="Carboidratos" value={`${round1(perServing.carbs)} g`} />
                  <Macro label="Gordura" value={`${round1(perServing.fat)} g`} />
                  <Macro label="Fibra" value={`${round1(perServing.fiber)} g`} />
                </dl>
              </section>

              <details className={styles.disclosure}>
                <summary>Ingredientes{recipe.instructions ? " e preparo" : ""}<ChevronDown size={17} aria-hidden="true" /></summary>
                <div className={styles.detailsBody}>
                  <p className={styles.optional}>Quantidades para a receita inteira.</p>
                  <ul className={styles.ingredients}>
                    {recipe.items.map((item) => <li key={item.id}><span>{item.food.name}</span><span>{round1(item.grams)} g</span></li>)}
                  </ul>
                  {recipe.instructions ? <div className={styles.instructions}><h3>Modo de preparo</h3><p>{recipe.instructions}</p></div> : null}
                </div>
              </details>

              {recipe.userId === user.id ? (
                <details className={styles.disclosure}>
                  <summary>
                    <span className={styles.summaryLabel}>
                      <Pencil size={15} aria-hidden="true" />
                      Editar receita
                    </span>
                    <ChevronDown size={17} aria-hidden="true" />
                  </summary>
                  <form action={updateRecipeAction} className={styles.editForm}>
                    <input type="hidden" name="recipeId" value={recipe.id} />
                    <div className="grid gap-3 md:grid-cols-[1fr_150px]">
                      <label className={styles.field}>Nome da receita<input name="name" className={inputClass} defaultValue={recipe.name} required /></label>
                      <label className={styles.field}>Porções<input name="servings" type="number" min="1" className={inputClass} defaultValue={recipe.servings} required /></label>
                    </div>
                    <RecipeIngredientFields
                      foods={foods}
                      initialIngredients={recipe.items.map((item) => ({
                        foodId: item.foodId,
                        foodName: item.food.name,
                        category: item.food.category,
                        grams: item.grams,
                      }))}
                    />
                    <label className={styles.field}><span>Modo de preparo <span className={styles.optional}>(opcional)</span></span><textarea
                      name="instructions"
                      className="min-h-24 rounded-[14px] bg-fill px-4 py-3 outline-none"
                      defaultValue={recipe.instructions ?? ""}
                      placeholder="Descreva como preparar a receita"
                    /></label>
                    <SubmitButton className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-fill text-text-primary hover:bg-fill-strong px-5 font-semibold">
                      <Save size={17} />
                      Salvar alterações
                    </SubmitButton>
                  </form>
                  <form action={deleteRecipeAction} className={styles.deleteForm}>
                    <input type="hidden" name="recipeId" value={recipe.id} />
                    <SubmitButton className={styles.deleteButton} aria-label={`Excluir receita ${recipe.name}`}><Trash2 size={16} />Excluir receita</SubmitButton>
                  </form>
                </details>
              ) : null}

              <div className={styles.actions}>
                <details className={styles.primaryDisclosure}>
                  <summary><span className={styles.summaryLabel}><Plus size={17} aria-hidden="true" />Registrar no diário</span><ChevronDown size={17} aria-hidden="true" /></summary>
                  <form action={addRecipePortionToDiaryAction} className={styles.usageForm}>
                    <input type="hidden" name="recipeId" value={recipe.id} />
                    <div className={styles.usageFields}>
                      <label className={styles.field}>Porções<input name="portions" defaultValue="1" inputMode="decimal" className={inputClass} /></label>
                      <label className={styles.field}>Refeição<select name="mealName" className={inputClass}>
                        {["Café da manhã", "Almoço", "Pré-treino", "Jantar", "Ceia"].map((meal) => <option key={meal}>{meal}</option>)}
                      </select></label>
                    </div>
                    <SubmitButton className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary/15 text-primary hover:bg-primary/20 px-4 text-sm font-semibold">
                      <Plus size={15} />
                      Registrar porções
                    </SubmitButton>
                  </form>
                </details>

                {activePlan ? (
                  <details className={styles.disclosure}>
                    <summary><span className={styles.summaryLabel}><BookOpen size={16} aria-hidden="true" />Adicionar à dieta</span><ChevronDown size={17} aria-hidden="true" /></summary>
                    <form action={addRecipePortionToPlanAction} className={styles.usageForm}>
                      <SafetyReview required={Boolean(dietaryReviewIssue(profile))} />
                      <input type="hidden" name="recipeId" value={recipe.id} />
                      <div className={styles.usageFields}>
                        <label className={styles.field}>Porções<input name="portions" defaultValue="1" inputMode="decimal" className={inputClass} /></label>
                        <label className={styles.field}>Refeição<select name="mealId" className={inputClass}>
                          {activePlanMeals.map((meal) => <option key={meal.id} value={meal.id}>{meal.name}</option>)}
                        </select></label>
                      </div>
                      <SubmitButton className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-fill text-text-primary hover:bg-fill-strong px-4 text-sm font-semibold">
                        <BookOpen size={15} />
                        Adicionar porções à dieta
                      </SubmitButton>
                    </form>
                  </details>
                ) : null}
              </div>
            </GlassCard>
          );
        })}
        {!recipes.length ? (
          <GlassCard>
            <p className="text-text-secondary">Salve sua primeira receita para usar no diário e no plano alimentar.</p>
          </GlassCard>
        ) : null}
      </div>);
  return <AppShell>
    <PageHeading title="Receitas" description={recipes.length ? `${recipes.length} ${recipes.length === 1 ? "preparação salva" : "preparações salvas"}` : "Salve preparações para usar no diário e na dieta."} />
    <Stack>
    <ReliabilityNotice status={recipeStatus ?? dietaryReviewIssue(profile)} />
    <WorkspaceTabs label="Organizar receitas" initial={recipes.length ? 0 : 1} items={[
      {id:"minhas-receitas",label:"Minhas receitas",content:library},
      {id:"nova-receita",label:"Criar receita",content:editor},
    ]} />
    </Stack>
  </AppShell>;
}

const inputClass = "h-12 rounded-[14px] bg-fill px-4 outline-none";

function Macro({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
