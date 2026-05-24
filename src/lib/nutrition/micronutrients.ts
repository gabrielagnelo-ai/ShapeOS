import type { Sex } from "./types";

export function suggestedMicronutrientTargets(input: { sex: Sex; age: number }) {
  return {
    calciumMg: 1000,
    ironMg: input.sex === "female" && input.age < 51 ? 18 : 8,
    magnesiumMg: input.sex === "male" ? 420 : 320,
    potassiumMg: input.sex === "male" ? 3400 : 2600,
    zincMg: input.sex === "male" ? 11 : 8,
    vitaminCMg: input.sex === "male" ? 90 : 75,
    vitaminDMcg: 15,
    vitaminB12Mcg: 2.4,
  };
}
