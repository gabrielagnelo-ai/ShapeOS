import { describe, expect, it } from "vitest";
import { dietaryReviewIssue, foodAllowedForProfile, manualPlanCompatibilityIssue, parseVerifiedRecipe, planCompatibilityIssue, prepareCalorieMatchedPlan, starterMealDrafts, starterMealsForNames } from "./food-reliability";

const profile = { allergies: [], restrictions: [], dislikedFoods: [] };
const foods = [
  { id: "rice", name: "Arroz branco cozido", kcalPer100g: 128 },
  { id: "beans", name: "Feijao carioca cozido", kcalPer100g: 76 },
  { id: "chicken", name: "Peito de frango grelhado", kcalPer100g: 159 },
  { id: "egg", name: "Ovo de galinha inteiro", kcalPer100g: 146 },
  { id: "oats", name: "Aveia em flocos", kcalPer100g: 394 },
  { id: "banana", name: "Banana prata", kcalPer100g: 98 },
  { id: "fish", name: "Tilapia grelhada", kcalPer100g: 128 },
  { id: "potato", name: "Batata doce cozida", kcalPer100g: 77 },
];
const meals = starterMealDrafts.filter((meal) => meal.name !== "Ceia");

describe("dietary compatibility", () => {
  it.each(["ovo", "substância desconhecida", "amendoim e leite"])("does not infer verified allergen absence for %s", (allergy) => {
    const restricted = { ...profile, allergies: [allergy] };
    expect(dietaryReviewIssue(restricted)).toBe("allergy-review");
    expect(prepareCalorieMatchedPlan(meals, foods, restricted, 2200).meals).toBeNull();
    expect(planCompatibilityIssue(["Arroz branco cozido"], restricted)).toBe("allergy-review");
  });
  it("requires manual review for free-text and ingredient-sensitive restrictions", () => {
    for (const restriction of ["sem lactose", "sem glúten", "hipossódica", "vegano sem soja"]) {
      expect(dietaryReviewIssue({ ...profile, restrictions: [restriction] })).toBe("restriction-review");
    }
  });
  it("normalizes explicitly absent declarations without ignoring ambiguous allergies", () => {
    expect(dietaryReviewIssue({ ...profile, allergies: ["Nenhuma"], restrictions: ["Não"] })).toBeNull();
    expect(dietaryReviewIssue({ ...profile, allergies: ["não sei"] })).toBe("allergy-review");
  });
  it("keeps known conflicts blocked even after a manual review acknowledgement", () => {
    const restricted = { ...profile, allergies: ["soja"], restrictions: ["Vegana"] };
    expect(manualPlanCompatibilityIssue(["Arroz branco cozido"], restricted, false)).toBe("allergy-review");
    expect(manualPlanCompatibilityIssue(["Arroz branco cozido"], restricted, true)).toBeNull();
    expect(manualPlanCompatibilityIssue(["Ovo de galinha inteiro"], restricted, true)).toBe("food-conflict");
    expect(planCompatibilityIssue(["Arroz branco cozido"], restricted)).toBe("allergy-review");
  });
  it("uses conservative known foods for vegetarian plans instead of treating unknown dishes as plant-based", () => {
    const vegetarian = { ...profile, restrictions: ["vegetariana"] };
    expect(foodAllowedForProfile("Ovo de galinha inteiro", vegetarian)).toBe(true);
    expect(foodAllowedForProfile("Sopa caseira", vegetarian)).toBe(false);
    expect(foodAllowedForProfile("Peito de frango grelhado", vegetarian)).toBe(false);
  });
});

describe("calorie-matched starter plans", () => {
  it("preserves selected snack names instead of silently dropping them", () => {
    const selected = ["Lanche da manhã", "Almoço", "Lanche da tarde"];
    expect(starterMealsForNames(selected).map((meal) => meal.name)).toEqual(selected);
    expect(starterMealsForNames(selected).every((meal) => meal.items.length)).toBe(true);
  });
  it.each([1600, 2200, 3000])("uses real food energy to match %i kcal within rounding tolerance", (target) => {
    const result = prepareCalorieMatchedPlan(meals, foods, profile, target);
    expect(result.issue).toBeNull();
    const total = result.meals!.flatMap((meal) => meal.items).reduce((sum, item) => sum + foods.find((food) => food.name === item.foodName)!.kcalPer100g * item.grams / 100, 0);
    expect(Math.abs(total - target)).toBeLessThan(2);
    expect(meals[0].items[0].grams).toBe(60);
  });
  it("excludes disliked foods and animal products before adjusting vegan calories", () => {
    const result = prepareCalorieMatchedPlan(meals, foods, { ...profile, restrictions: ["vegana"], dislikedFoods: ["aveia"] }, 1800);
    expect(result.issue).toBeNull();
    const names = result.meals!.flatMap((meal) => meal.items.map((item) => item.foodName));
    expect(names).not.toContain("Ovo de galinha inteiro");
    expect(names).not.toContain("Aveia em flocos");
    expect(names).not.toContain("Peito de frango grelhado");
  });
  it("never invents nutritional values or saves empty meals when data is absent", () => {
    expect(prepareCalorieMatchedPlan(meals, [], profile, 2200).issue).toBe("insufficient-foods");
    expect(prepareCalorieMatchedPlan(meals, foods, profile, NaN).issue).toBe("invalid-target");
    expect(prepareCalorieMatchedPlan(meals, foods.map((food) => ({ ...food, kcalPer100g: 1 })), profile, 2200).issue).toBe("invalid-target");
  });
});

describe("AI recipe parsing without fabricated fallback", () => {
  const recipe = { name: "Arroz", servings: 1, items: [{ foodName: "Arroz branco cozido", grams: 100 }] };
  const allowed = new Set(foods.map((food) => food.name));
  it("accepts a complete recipe using only precisely identified foods", () => {
    expect(parseVerifiedRecipe(JSON.stringify(recipe), allowed)).toEqual(recipe);
  });
  it.each(["", "null", "API unavailable", '{"name":"Pizza"}', '{"name":"Pizza","servings":1,"items":[null]}'])("rejects an invalid response instead of manufacturing a meal: %s", (response) => {
    expect(parseVerifiedRecipe(response, allowed)).toBeNull();
  });
  it("rejects the entire recipe if any ingredient is unknown or a quantity is invalid", () => {
    expect(parseVerifiedRecipe(JSON.stringify({ ...recipe, items: [...recipe.items, { foodName: "Pizza", grams: 200 }] }), allowed)).toBeNull();
    expect(parseVerifiedRecipe(JSON.stringify({ ...recipe, items: [{ ...recipe.items[0], grams: -1 }] }), allowed)).toBeNull();
    expect(parseVerifiedRecipe(JSON.stringify({ ...recipe, servings: 0 }), allowed)).toBeNull();
  });
});
