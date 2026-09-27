import { describe, expect, it } from "vitest";
import { parseOnboardingInput } from "./onboarding-input";

function form(changes: Record<string, string | undefined> = {}) {
  const data = new FormData();
  Object.entries({ name: "Teste", sex: "male", age: "30", height: "1,80", weight: "80,5", neckCm: "38", waistCm: "90", goal: "fat_loss", activityLevel: "moderate", experience: "beginner", mode: "guided", medicalConditions: "none", ...changes }).forEach(([name, value]) => { if (value !== undefined) data.set(name, value); });
  return data;
}
describe("onboarding input", () => {
  it("normalizes Brazilian measurements and supplies numeric defaults", () => {
    const result = parseOnboardingInput(form(), "Default");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject({ heightCm: 180, weightKg: 80.5, deficitKcal: 400, proteinPerKg: 2, fatPerKg: 0.8 });
  });
  it.each([{ age: "texto" }, { age: "-2" }, { age: "30.5" }, { weight: "0" }, { height: "900" }, { sex: "invalid" }, { goal: "invalid" }, { medicalConditions: "" }, { mode: "invalid" }, { waistCm: "20" }, { proteinPerKg: "4" }, { calorieDeficitKcal: "Infinity" }])("rejects invalid data before calculations: %j", (change) => {
    expect(parseOnboardingInput(form(change), "Default").success).toBe(false);
  });
  it("requires hip measurement only when applicable", () => {
    expect(parseOnboardingInput(form({ sex: "female" }), "Default").success).toBe(false);
    expect(parseOnboardingInput(form({ sex: "female", hipCm: "100" }), "Default").success).toBe(true);
  });
  it("checks manual activity factor in advanced mode", () => {
    expect(parseOnboardingInput(form({ mode: "advanced", manualActivityFactor: "9" }), "Default").success).toBe(false);
    expect(parseOnboardingInput(form({ mode: "advanced", manualActivityFactor: "1,45" }), "Default").success).toBe(true);
  });
});
