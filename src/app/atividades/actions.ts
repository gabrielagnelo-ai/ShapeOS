"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { estimateActivityCalories, findActivityPreset } from "@/lib/activity";
import { prisma } from "@/lib/prisma";

export async function addPhysicalActivityAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const profile = await prisma.profile.findUnique({ where: { userId: user.id }, select: { weightKg: true } });
  if (!profile) return;

  const activityKey = String(formData.get("activityKey") ?? "walk_fast");
  const preset = findActivityPreset(activityKey);
  const customName = String(formData.get("customName") ?? "").trim();
  const met = clamp(parsePositiveNumber(formData.get("met")) ?? preset.met, 1, 18);
  const durationMinutes = Math.round(clamp(parsePositiveNumber(formData.get("durationMinutes")) ?? 0, 1, 600));
  const date = parseDate(String(formData.get("date") ?? "")) ?? startOfToday();
  const note = String(formData.get("note") ?? "").trim();
  if (!durationMinutes) return;

  await prisma.physicalActivityLog.create({
    data: {
      userId: user.id,
      date,
      activityKey,
      name: customName || preset.name,
      met,
      durationMinutes,
      caloriesKcal: estimateActivityCalories({ met, weightKg: profile.weightKg, durationMinutes }),
      intensity: preset.intensity,
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
