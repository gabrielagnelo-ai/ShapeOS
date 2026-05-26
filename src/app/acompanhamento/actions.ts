"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createBodyCompositionSnapshot } from "@/lib/body-composition";
import { calculateBmr, calculateTdee, type Sex } from "@/lib/nutrition";
import { prisma } from "@/lib/prisma";
import { validateTdeeTrend } from "@/lib/tdee";

export async function saveWeeklyCheckinAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) return;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const averageWeightKg = parseDecimal(String(formData.get("averageWeightKg") ?? "0"));
  const waistCm = optionalDecimal(formData.get("waistCm"));

  await prisma.weeklyCheckin.create({
    data: {
      userId: user.id,
      weekStart,
      averageWeightKg,
      waistCm,
      adherencePct: parseDecimal(String(formData.get("adherencePct") ?? "0")),
      hunger: Number(formData.get("hunger") ?? 5),
      energy: Number(formData.get("energy") ?? 5),
      sleep: Number(formData.get("sleep") ?? 5),
      trainingDone: String(formData.get("trainingDone") ?? "") === "on",
      notes: String(formData.get("notes") ?? ""),
    },
  });

  await createBodyCompositionSnapshot({
    userId: user.id,
    source: "weekly_checkin",
    sex: profile.sex === "MALE" ? "male" : "female",
    heightCm: profile.heightCm,
    weightKg: averageWeightKg,
    neckCm: profile.neckCm,
    waistCm: waistCm ?? profile.waistCm,
    hipCm: profile.hipCm,
    measuredAt: weekStart,
  });

  const [checkins, foodLogs] = await Promise.all([
    prisma.weeklyCheckin.findMany({ where: { userId: user.id }, orderBy: { weekStart: "asc" }, take: 8 }),
    prisma.foodLog.findMany({
      where: { userId: user.id },
      include: { items: { include: { food: true } } },
      orderBy: { date: "desc" },
      take: 14,
    }),
  ]);
  const bmr = calculateBmr({
    sex: (profile.sex === "MALE" ? "male" : "female") as Sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: averageWeightKg,
  });
  const tdee = calculateTdee(bmr, profile.activityFactor) + profile.tdeeAdjustmentKcal;
  const validation = validateTdeeTrend({
    tdee,
    averageIntakeKcal: averageFoodLogCalories(foodLogs),
    checkins,
  });
  const nextAdjustment = clamp(profile.tdeeAdjustmentKcal + validation.suggestedAdjustmentKcal, -500, 500);

  await prisma.profile.update({
    where: { userId: user.id },
    data: {
      tdeeConfidence: validation.confidence,
      tdeeAdjustmentKcal: nextAdjustment,
    },
  });

  revalidatePath("/acompanhamento");
  revalidatePath("/coach");
  revalidatePath("/dashboard");
}

function parseDecimal(value: string) {
  return Number(value.replace(",", "."));
}

function optionalDecimal(value: FormDataEntryValue | null) {
  if (!value) return null;
  const parsed = parseDecimal(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function averageFoodLogCalories(logs: Array<{ items: Array<{ grams: number; food: { kcalPer100g: number } }> }>) {
  const days = logs.filter((log) => log.items.length);
  if (!days.length) return 0;

  const total = days.reduce((sum, log) => (
    sum + log.items.reduce((dayTotal, item) => dayTotal + (item.food.kcalPer100g * item.grams) / 100, 0)
  ), 0);

  return Math.round(total / days.length);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
