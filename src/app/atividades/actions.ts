"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  conservativeActivityFactor,
  estimateActivityCalories,
  estimateMetByEffort,
  estimateWalkingFromDistanceTime,
  findActivityEffort,
  findActivityPreset,
  isWalkingActivity,
} from "@/lib/activity";
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
  const durationMinutes = Math.round(clamp(parsePositiveNumber(formData.get("durationMinutes")) ?? 0, 1, 600));
  const distanceKm = parsePositiveNumber(formData.get("distanceKm"));
  const date = parseDate(String(formData.get("date") ?? "")) ?? startOfToday();
  const note = String(formData.get("note") ?? "").trim();
  const tdeeChoice = normalizeTdeeChoice(String(formData.get("tdeeChoice") ?? "auto"));
  if (!durationMinutes) return;

  const walking = isWalkingActivity(activityKey);
  const walkingEstimate = walking && distanceKm
    ? estimateWalkingFromDistanceTime({ distanceKm, durationMinutes, weightKg: profile.weightKg })
    : null;
  if (walking && !walkingEstimate) return;

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
  const met = walkingEstimate?.met ?? clamp(advancedMet ?? estimateMetByEffort(preset.met, effort.key), 1, 18);
  const caloriesKcal = walkingEstimate?.caloriesKcal ?? estimateActivityCalories({ met, weightKg: profile.weightKg, durationMinutes });
  const source = walkingEstimate ? "manual_distance" : "manual_met";
  const confidenceFactor = walkingEstimate?.confidenceFactor ?? conservativeActivityFactor({ activityKey, source });

  await prisma.physicalActivityLog.create({
    data: {
      userId: user.id,
      date,
      activityKey,
      name: customName || walkingEstimate?.label || preset.name,
      met,
      durationMinutes,
      distanceKm: walkingEstimate ? distanceKm : null,
      averageSpeedKmh: walkingEstimate?.speedKmh ?? null,
      caloriesKcal,
      conservativeCaloriesKcal: walkingEstimate?.conservativeCaloriesKcal ?? Math.round(caloriesKcal * confidenceFactor),
      confidenceFactor,
      countsTowardTdee,
      intensity: walkingEstimate?.intensity ?? effort.label,
      note: note || null,
      source,
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
