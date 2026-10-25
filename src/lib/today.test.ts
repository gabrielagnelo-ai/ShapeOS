import { describe, expect, it } from "vitest";
import { estimateBodyEnergy, nextTrainingDay, summarizeSleep, summarizeTodayMeals, trainingWeek } from "./today";

const day = (date: string, values: Partial<{ sleepMinutes: number; restingHeartRateBpm: number; activeEnergyKcal: number; workoutMinutes: number; steps: number }> = {}) => ({
  date: new Date(date), sleepMinutes: null, restingHeartRateBpm: null, activeEnergyKcal: null, workoutMinutes: null, steps: null, ...values,
});

describe("today summaries", () => {
  it("lists logged meals by meal order and adds planned meals still missing", () => {
    const meals = summarizeTodayMeals(
      [{ mealName: "Almoco", kcal: 500 }, { mealName: "Café da manhã", kcal: 300 }, { mealName: "Almoço", kcal: 280 }],
      [{ name: "Café da manhã", kcal: 350 }, { name: "Jantar", kcal: 460 }],
    );
    expect(meals).toEqual([
      { name: "Café da manhã", kcal: 300, status: "logged" },
      { name: "Almoço", kcal: 780, status: "logged" },
      { name: "Jantar", kcal: 460, status: "planned" },
    ]);
  });

  it("picks the day after the last trained one and reports the load change", () => {
    const exercise = (name: string, logs: { date: string; loadKg: number }[]) => ({ name, sets: "4", reps: "8", logs: logs.map((l) => ({ date: new Date(l.date), loadKg: l.loadKg })) });
    const next = nextTrainingDay([
      { name: "Treino B", focus: "Costas", order: 2, exercises: [exercise("Remada", [{ date: "2026-10-20", loadKg: 60 }])] },
      { name: "Treino A", focus: "Peito", order: 1, exercises: [exercise("Supino", [{ date: "2026-10-18", loadKg: 77.5 }, { date: "2026-10-11", loadKg: 75 }])] },
    ])!;
    expect(next.name).toBe("Treino A");
    expect(next.exercises[0]).toEqual({ name: "Supino", prescription: "4 séries de 8", loadKg: 77.5, loadDeltaKg: 2.5 });
    expect(nextTrainingDay([])).toBeNull();
  });

  it("marks training days in the last week", () => {
    const week = trainingWeek([new Date("2026-10-20T10:00"), new Date("2026-10-22T08:00")], new Date("2026-10-22T12:00"));
    expect(week.map((d) => d.trained)).toEqual([false, false, false, false, true, false, true]);
  });

  it("summarizes sleep only when there is data", () => {
    expect(summarizeSleep([day("2026-10-21")])).toBeNull();
    const sleep = summarizeSleep([day("2026-10-21", { sleepMinutes: 400 }), day("2026-10-22", { sleepMinutes: 440 })])!;
    expect(sleep).toMatchObject({ lastNightMinutes: 440, averageMinutes: 420 });
  });

  it("estimates body energy from sleep, resting heart rate and activity", () => {
    expect(estimateBodyEnergy([day("2026-10-22", { steps: 5000 })])).toBeNull();
    const rested = estimateBodyEnergy([
      day("2026-10-20", { restingHeartRateBpm: 58 }),
      day("2026-10-21", { restingHeartRateBpm: 58 }),
      day("2026-10-22", { sleepMinutes: 480, restingHeartRateBpm: 54, activeEnergyKcal: 250 }),
    ])!;
    const tired = estimateBodyEnergy([
      day("2026-10-20", { restingHeartRateBpm: 58 }),
      day("2026-10-21", { restingHeartRateBpm: 58 }),
      day("2026-10-22", { sleepMinutes: 300, restingHeartRateBpm: 64, activeEnergyKcal: 900 }),
    ])!;
    expect(rested.score).toBeGreaterThan(tired.score);
    expect(rested.restingHeartRate).toEqual({ bpm: 54, vsAverage: -4 });
    expect(rested.score).toBeLessThanOrEqual(100);
    expect(tired.level).toBe("baixa");
  });
});
