"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { conservativeActivityFactor, estimateActivityCalories, estimateMetByEffort, findActivityEffort, findActivityPreset } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { shouldCountActivity, type TdeeMode } from "@/lib/tdee";

export async function addPhysicalActivityAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { weightKg: true, activityFactor: true, tdeeCalculationMode: true },
  });
  if (!profile) return;

  const activityKey = String(formData.get("activityKey") ?? "walk_fast");
  const preset = findActivityPreset(activityKey);
  const effortKey = String(formData.get("effort") ?? "moderate");
  const effort = findActivityEffort(effortKey);
  const customName = String(formData.get("customName") ?? "").trim();
  const advancedMet = parsePositiveNumber(formData.get("met"));
  const met = clamp(advancedMet ?? estimateMetByEffort(preset.met, effort.key), 1, 18);
  const durationMinutes = Math.round(clamp(parsePositiveNumber(formData.get("durationMinutes")) ?? 0, 1, 600));
  const date = parseDate(String(formData.get("date") ?? "")) ?? startOfToday();
  const note = String(formData.get("note") ?? "").trim();
  const tdeeChoice = normalizeTdeeChoice(String(formData.get("tdeeChoice") ?? "auto"));
  if (!durationMinutes) return;

  if (tdeeChoice === "switch_additive") {
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        tdeeCalculationMode: "ADDITIVE",
        activityFactor: Math.min(profile.activityFactor, 1.3),
      },
    });
  }

  const mode = (tdeeChoice === "switch_additive" ? "ADDITIVE" : profile.tdeeCalculationMode) as TdeeMode;
  const countChoice = tdeeChoice === "count_extra" ? "count_extra" : tdeeChoice === "ignore" ? "ignore" : "auto";
  const countsTowardTdee = shouldCountActivity({
    mode,
    activityFactor: tdeeChoice === "switch_additive" ? Math.min(profile.activityFactor, 1.3) : profile.activityFactor,
    activityKey,
    userChoice: countChoice,
  });
  const caloriesKcal = estimateActivityCalories({ met, weightKg: profile.weightKg, durationMinutes });
  const confidenceFactor = conservativeActivityFactor({ activityKey, source: "manual_met" });

  await prisma.physicalActivityLog.create({
    data: {
      userId: user.id,
      date,
      activityKey,
      name: customName || preset.name,
      met,
      durationMinutes,
      caloriesKcal,
      conservativeCaloriesKcal: Math.round(caloriesKcal * confidenceFactor),
      confidenceFactor,
      countsTowardTdee,
      intensity: effort.label,
      note: note || null,
    },
  });

  revalidatePath("/atividades");
  revalidatePath("/dashboard");
}

export async function deletePhysicalActivityAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.physicalActivityLog.deleteMany({
    where: { id: String(formData.get("activityId") ?? ""), userId: user.id },
  });

  revalidatePath("/atividades");
  revalidatePath("/dashboard");
}

function parsePositiveNumber(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeTdeeChoice(value: string) {
  return ["auto", "ignore", "count_extra", "switch_additive"].includes(value) ? value : "auto";
}
