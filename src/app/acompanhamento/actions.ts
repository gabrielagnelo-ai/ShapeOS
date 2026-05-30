"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createBodyCompositionSnapshot } from "@/lib/body-composition";
import { calculateBmr, calculateTdee, type Sex } from "@/lib/nutrition";
import { calendarPeriods, foodPeriodSummary } from "@/lib/period-averages";
import { prisma } from "@/lib/prisma";
import { validateTdeeTrend } from "@/lib/tdee";

const MAX_BODY_PHOTOS_PER_CHECKIN = 8;
const MAX_BODY_PHOTO_BYTES = 5 * 1024 * 1024;

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
  const neckCm = optionalDecimal(formData.get("neckCm"));
  const hipCm = profile.sex === "FEMALE" ? optionalDecimal(formData.get("hipCm")) : null;
  const resolvedWaistCm = waistCm ?? profile.waistCm;
  const resolvedNeckCm = neckCm ?? profile.neckCm;
  const resolvedHipCm = profile.sex === "FEMALE" ? hipCm ?? profile.hipCm : null;

  const checkin = await prisma.weeklyCheckin.create({
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

  await saveBodyPhotos({
    userId: user.id,
    checkinId: checkin.id,
    files: formData.getAll("bodyPhotos"),
  });

  await createBodyCompositionSnapshot({
    userId: user.id,
    source: "weekly_checkin",
    sex: profile.sex === "MALE" ? "male" : "female",
    heightCm: profile.heightCm,
    weightKg: averageWeightKg,
    neckCm: resolvedNeckCm,
    waistCm: resolvedWaistCm,
    hipCm: resolvedHipCm,
    measuredAt: weekStart,
  });

  const periods = calendarPeriods();
  const [checkins, foodLogs] = await Promise.all([
    prisma.weeklyCheckin.findMany({ where: { userId: user.id }, orderBy: { weekStart: "asc" }, take: 8 }),
    prisma.foodLog.findMany({
      where: { userId: user.id, date: { gte: periods.month.start, lt: periods.month.end } },
      include: { items: { include: { food: true } } },
      orderBy: { date: "desc" },
    }),
  ]);
  const monthlyFood = foodPeriodSummary(foodLogs.map((log) => ({
    date: log.date,
    items: log.items.map((item) => ({
      grams: item.grams,
      food: {
        name: item.food.name,
        kcalPer100g: item.food.kcalPer100g,
        proteinPer100g: item.food.proteinPer100g,
        carbsPer100g: item.food.carbsPer100g,
        fatPer100g: item.food.fatPer100g,
        fiberPer100g: item.food.fiberPer100g ?? 0,
        sodiumPer100g: item.food.sodiumPer100g ?? 0,
      },
    })),
  })), periods.month);
  const bmr = calculateBmr({
    sex: (profile.sex === "MALE" ? "male" : "female") as Sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: averageWeightKg,
  });
  const tdee = calculateTdee(bmr, profile.activityFactor) + profile.tdeeAdjustmentKcal;
  const validation = validateTdeeTrend({
    tdee,
    averageIntakeKcal: Math.round(monthlyFood.average.kcal),
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
  revalidatePath("/configuracoes");
  revalidatePath("/relatorio-nutricionista");
}

export async function deleteWeeklyCheckinAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const checkinId = String(formData.get("checkinId") ?? "");
  if (!checkinId) return;

  const checkin = await prisma.weeklyCheckin.findFirst({
    where: { id: checkinId, userId: user.id },
    select: { id: true, weekStart: true },
  });
  if (!checkin) return;

  await prisma.$transaction([
    prisma.weeklyCheckin.delete({ where: { id: checkin.id } }),
    prisma.bodyCompositionSnapshot.deleteMany({
      where: {
        userId: user.id,
        source: "weekly_checkin",
        measuredAt: checkin.weekStart,
      },
    }),
  ]);

  revalidatePath("/acompanhamento");
  revalidatePath("/coach");
  revalidatePath("/dashboard");
  revalidatePath("/configuracoes");
  revalidatePath("/relatorio-nutricionista");
}

export async function uploadCheckinPhotosAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const checkinId = String(formData.get("checkinId") ?? "");
  if (!checkinId) return;

  const checkin = await prisma.weeklyCheckin.findFirst({
    where: { id: checkinId, userId: user.id },
    select: { id: true },
  });
  if (!checkin) return;

  await saveBodyPhotos({
    userId: user.id,
    checkinId: checkin.id,
    files: formData.getAll("bodyPhotos"),
  });

  revalidatePath("/acompanhamento");
  revalidatePath("/relatorio-nutricionista");
}

export async function deleteBodyPhotoAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const photoId = String(formData.get("photoId") ?? "");
  if (!photoId) return;

  await prisma.bodyPhoto.deleteMany({
    where: { id: photoId, userId: user.id },
  });

  revalidatePath("/acompanhamento");
  revalidatePath("/relatorio-nutricionista");
}

function parseDecimal(value: string) {
  return Number(value.replace(",", "."));
}

function optionalDecimal(value: FormDataEntryValue | null) {
  if (!value) return null;
  const parsed = parseDecimal(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function saveBodyPhotos({ userId, checkinId, files }: { userId: string; checkinId: string; files: FormDataEntryValue[] }) {
  const validFiles = files.filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (!validFiles.length) return;

  const currentCount = await prisma.bodyPhoto.count({
    where: { userId, weeklyCheckinId: checkinId },
  });
  const remainingSlots = Math.max(0, MAX_BODY_PHOTOS_PER_CHECKIN - currentCount);
  if (!remainingSlots) return;

  const photos = await Promise.all(validFiles.slice(0, remainingSlots).map(async (file, index) => {
    if (!file.type.startsWith("image/") || file.size > MAX_BODY_PHOTO_BYTES) return null;

    const bytes = Buffer.from(await file.arrayBuffer());
    return {
      userId,
      weeklyCheckinId: checkinId,
      fileName: file.name || `foto-${currentCount + index + 1}`,
      imageMimeType: file.type,
      imageData: bytes,
      position: currentCount + index,
    };
  }));

  const data = photos.filter((photo): photo is NonNullable<typeof photo> => photo !== null);
  if (!data.length) return;

  await prisma.bodyPhoto.createMany({ data });
}
