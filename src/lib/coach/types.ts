export type InsightCategory = "nutrition" | "weight" | "sleep" | "adherence" | "training";
export type InsightStatus = "new" | "seen" | "resolved";

export type CoachInsight = {
  trigger: string;
  priority: number;
  status: InsightStatus;
  category: InsightCategory;
  message: string;
  createdAt: Date;
};

export type CoachContext = {
  proteinLast3DaysPct: number[];
  weightStableDays: number;
  adherenceStreakDays: number;
  sleepTrend: "up" | "stable" | "down";
  currentDeficitPct: number;
  goal: "fat_loss" | "maintenance" | "muscle_gain";
  trainingDoneThisWeek: number;
  lowMicronutrients?: string[];
};
