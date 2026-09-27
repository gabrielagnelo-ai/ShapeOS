import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const database = {
    user: { update: vi.fn() },
    profile: { findUnique: vi.fn() },
    food: { findMany: vi.fn(), findFirst: vi.fn() },
    dietPlan: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    recipe: { create: vi.fn(), findFirst: vi.fn() },
    dietMeal: { findFirst: vi.fn() },
    foodLog: { upsert: vi.fn() },
    foodLogItem: { findFirst: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { database, generate: vi.fn(), fetch: vi.fn(), snapshot: vi.fn() };
});
vi.mock("@/lib/prisma", () => ({ prisma: mocks.database }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => ({ id: "test-user", name: "Teste", email: "audit@example.test" })) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/body-composition", () => ({ createBodyCompositionSnapshot: mocks.snapshot }));
vi.mock("@/lib/profile", () => ({ startOfToday: () => new Date("2026-01-01T00:00:00Z"), computeCurrentProfileMetrics: vi.fn() }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { models = { generateContent: mocks.generate }; } }));

import { estimateEatenRecipeAction, generateAiRecipeSuggestionAction } from "../app/receitas/actions";
import { setActiveDietPlanAction, syncShoppingBudgetToFluxaAction } from "../app/dieta/actions";
import { updateFoodLogItemAction, deleteFoodLogItemAction, registerDietMealAction } from "../app/diario/actions";
import { saveOnboardingAction } from "../app/onboarding/actions";

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-02T15:00:00Z"));
  mocks.database.$transaction.mockImplementation(async (operation) => typeof operation === "function" ? operation(mocks.database) : Promise.all(operation));
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("FLUXA_INTEGRATION_SECRET", "only-test-secret-with-more-than-thirty-two-characters");
  vi.stubEnv("FLUXA_API_URL", "https://example.test");
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.database.profile.findUnique.mockResolvedValue({ allergies: [], restrictions: [], dislikedFoods: [] });
  mocks.database.food.findMany.mockResolvedValue([{ id: "rice", name: "Arroz branco cozido", category: "Cereais", kcalPer100g: 128, proteinPer100g: 2.5, carbsPer100g: 28, fatPer100g: 0.2 }]);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("server action reliability boundaries (all IO mocked)", () => {
  it("does not save a fake meal when an estimation request fails", async () => {
    mocks.generate.mockRejectedValue(new Error("network"));
    await expect(estimateEatenRecipeAction(form({ description: "Duas fatias de pizza" }))).rejects.toThrow("recipeStatus=ai-unavailable");
    expect(mocks.database.recipe.create).not.toHaveBeenCalled();
  });
  it("does not fall back to a fixed recipe when API configuration is absent", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(estimateEatenRecipeAction(form({ description: "Pizza" }))).rejects.toThrow("recipeStatus=ai-unavailable");
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.database.recipe.create).not.toHaveBeenCalled();
  });
  it("rejects unknown ingredients instead of saving a partial result", async () => {
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ name: "Pizza", servings: 1, items: [{ foodName: "Arroz branco cozido", grams: 100 }, { foodName: "Pizza", grams: 100 }] }) });
    await expect(estimateEatenRecipeAction(form({ description: "Pizza" }))).rejects.toThrow("recipeStatus=ai-unavailable");
    expect(mocks.database.recipe.create).not.toHaveBeenCalled();
  });
  it("blocks suggestion generation before contacting AI when allergy metadata is unavailable", async () => {
    mocks.database.profile.findUnique.mockResolvedValue({ allergies: ["amendoim"], restrictions: [], dislikedFoods: [] });
    await expect(generateAiRecipeSuggestionAction(form({ query: "Lanche" }))).rejects.toThrow("recipeStatus=allergy-review");
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.database.recipe.create).not.toHaveBeenCalled();
  });
  it("does not call Fluxa for a partial estimate without explicit acknowledgement", async () => {
    mocks.database.dietPlan.findFirst.mockResolvedValue({ id: "plan", name: "Plano", meals: [{ items: [
      { grams: 100, food: { id: "rice", name: "Arroz", category: "Cereais", pricePerKg: 8 } },
      { grams: 100, food: { id: "beans", name: "Feijão", category: "Leguminosas", pricePerKg: null } },
    ] }] });
    await expect(syncShoppingBudgetToFluxaAction(form({ periodo: "semanal" }))).rejects.toThrow("fluxa=partial-prices");
    expect(mocks.fetch).not.toHaveBeenCalled();
    mocks.fetch.mockResolvedValue({ ok: true });
    await expect(syncShoppingBudgetToFluxaAction(form({ periodo: "semanal", confirmPartialEstimate: "on" }))).rejects.toThrow("fluxa=ok");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(payload.days).toBe(30);
    expect(payload.summary.missingPriceCount).toBe(1);
  });
  it("requires review to activate a plan for an allergy profile", async () => {
    mocks.database.profile.findUnique.mockResolvedValue({ allergies: ["soja"], restrictions: [], dislikedFoods: [] });
    mocks.database.dietPlan.findFirst.mockResolvedValue({ id: "plan", meals: [{ items: [{ food: { name: "Arroz branco cozido" } }] }] });
    await expect(setActiveDietPlanAction(form({ planId: "plan" }))).rejects.toThrow("dietStatus=allergy-review");
    expect(mocks.database.$transaction).not.toHaveBeenCalled();
    await setActiveDietPlanAction(form({ planId: "plan", confirmSafetyReview: "on" }));
    expect(mocks.database.$transaction).toHaveBeenCalledTimes(1);
  });
  it("never mutates a profile when input validation fails", async () => {
    await expect(saveOnboardingAction(form({ name: "Teste", age: "not a number" }))).rejects.toThrow("onboardingError=invalid-input");
    expect(mocks.database.user.update).not.toHaveBeenCalled();
    expect(mocks.database.dietPlan.create).not.toHaveBeenCalled();
  });
});


describe("diary ownership, dates and imported-meal provenance", () => {
  const entry = { itemId: "item", foodId: "rice", grams: "120", mealName: "Almoço", date: "2026-06-01" };
  it("keeps edited meal provenance so registering the meal again replaces rather than duplicates", async () => {
    type Row = { id?: string; foodLogId: string; foodId: string; sourceDietMealId: string; grams: number; mealName: string };
    let rows: Row[] = [{ id: "item", foodLogId: "log", foodId: "rice", sourceDietMealId: "meal", grams: 100, mealName: "Almoço" }];
    mocks.database.foodLogItem.findFirst.mockImplementation(async () => rows[0]);
    mocks.database.foodLog.upsert.mockResolvedValue({ id: "log" });
    mocks.database.foodLogItem.update.mockImplementation(async ({ data }) => { rows[0] = { ...rows[0], ...data }; return rows[0]; });
    mocks.database.dietMeal.findFirst.mockResolvedValue({ id: "meal", name: "Almoço", items: [{ foodId: "rice", grams: 100 }] });
    mocks.database.foodLogItem.deleteMany.mockImplementation(async ({ where }) => { rows = rows.filter((row) => row.foodLogId !== where.foodLogId || row.sourceDietMealId !== where.sourceDietMealId); return { count: 1 }; });
    mocks.database.foodLogItem.createMany.mockImplementation(async ({ data }) => { rows.push(...data); return { count: data.length }; });
    expect(await updateFoodLogItemAction({}, form(entry))).toHaveProperty("success");
    expect(rows[0].sourceDietMealId).toBe("meal");
    expect(rows[0].grams).toBe(120);
    await registerDietMealAction(form({ mealId: "meal", date: entry.date }));
    expect(rows).toHaveLength(1);
    expect(rows[0].grams).toBe(100);
    expect(mocks.database.foodLog.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ update: { date: new Date("2026-06-01T03:00:00Z") } }));
  });
  it("cannot edit someone else's row or replace its food identifier", async () => {
    mocks.database.foodLogItem.findFirst.mockResolvedValue(null);
    expect(await updateFoodLogItemAction({}, form(entry))).toHaveProperty("error");
    expect(mocks.database.foodLogItem.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "item", foodLog: { userId: "test-user" } } }));
    expect(mocks.database.foodLogItem.update).not.toHaveBeenCalled();
    mocks.database.foodLogItem.findFirst.mockResolvedValue({ foodId: "other-food" });
    expect(await updateFoodLogItemAction({}, form(entry))).toHaveProperty("error");
    expect(mocks.database.foodLog.upsert).not.toHaveBeenCalled();
  });
  it.each(["2026-02-30", "2026-06-03", "invalid"])("rejects invalid/future date %s without touching data", async (date) => {
    expect(await updateFoodLogItemAction({}, form({ ...entry, date }))).toHaveProperty("error");
    expect(mocks.database.$transaction).not.toHaveBeenCalled();
  });
  it("returns a recoverable deletion error and scopes deletion to the signed-in user", async () => {
    mocks.database.foodLogItem.deleteMany.mockRejectedValue(new Error("database unavailable"));
    expect(await deleteFoodLogItemAction({}, form({ itemId: "item", confirmDelete: "on" }))).toEqual({ error: "Não foi possível remover o registro. Tente novamente." });
    expect(mocks.database.foodLogItem.deleteMany).toHaveBeenCalledWith({ where: { id: "item", foodLog: { userId: "test-user" } } });
  });
});
