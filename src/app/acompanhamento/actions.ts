"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createBodyCompositionSnapshot } from "@/lib/body-composition";
import { parseCircumferences } from "@/lib/body-measurements";
import { toFoodNutrients } from "@/lib/nutrition";
import { computeProfileMetrics } from "@/lib/profile-metrics";
import { calendarPeriods, foodPeriodSummary } from "@/lib/period-averages";
import { prisma } from "@/lib/prisma";
import { validateTdeeTrend } from "@/lib/tdee";
import { clamp } from "@/lib/common";

const MAX_BODY_PHOTOS_PER_CHECKIN = 8;
const MAX_BODY_PHOTO_BYTES = 5 * 1024 * 1024;

export type PhotoUploadState = {
  ok: boolean;
  message: string;
};

export async function saveWeeklyCheckinAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente para salvar o check-in.");

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) throw new Error("Complete seu perfil antes de salvar o check-in.");

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const averageWeightKg = parseDecimal(String(formData.get("averageWeightKg") ?? "0"));
  const waistCm = optionalDecimal(formData.get("waistCm"));
  const neckCm = optionalDecimal(formData.get("neckCm"));
  // quadril é obrigatório para o BF feminino; para homens é opcional e só alimenta o modelo corporal
  const hipCm = optionalDecimal(formData.get("hipCm"));
  const resolvedWaistCm = waistCm ?? profile.waistCm;
  const resolvedNeckCm = neckCm ?? profile.neckCm;
  const resolvedHipCm = hipCm ?? profile.hipCm;
  const circumferences = parseCircumferences(formData);

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
    ...circumferences,
    measuredAt: weekStart,
  });

  const periods = calendarPeriods();
  const [recentCheckins, foodLogs] = await Promise.all([
    prisma.weeklyCheckin.findMany({ where: { userId: user.id }, orderBy: { weekStart: "desc" }, take: 8 }),
    prisma.foodLog.findMany({
      where: { userId: user.id, date: { gte: periods.month.start, lt: periods.month.end } },
      include: { items: { include: { food: true } } },
      orderBy: { date: "desc" },
    }),
  ]);
  const checkins = [...recentCheckins].reverse();
  const monthlyFood = foodPeriodSummary(foodLogs.map((log) => ({
    date: log.date,
    items: log.items.map((item) => ({
      grams: item.grams,
      food: toFoodNutrients(item.food),
    })),
  })), periods.month);
  const { tdee } = computeProfileMetrics(profile, { weightKg: averageWeightKg });
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
  if (!user) return { ok: false, message: "Sessão expirada. Entre novamente." };

  const checkinId = String(formData.get("checkinId") ?? "");
  if (!checkinId) return { ok: false, message: "Check-in não encontrado." };

  const checkin = await prisma.weeklyCheckin.findFirst({
    where: { id: checkinId, userId: user.id },
    select: { id: true },
  });
  if (!checkin) return { ok: false, message: "Check-in não encontrado." };

  const result = await saveBodyPhotos({
    userId: user.id,
    checkinId: checkin.id,
    files: formData.getAll("bodyPhotos"),
  });

  revalidatePath("/acompanhamento");
  revalidatePath("/relatorio-nutricionista");

  return result;
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

async function saveBodyPhotos({ userId, checkinId, files }: { userId: string; checkinId: string; files: FormDataEntryValue[] }): Promise<PhotoUploadState> {
  const validFiles = files.filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (!validFiles.length) return { ok: false, message: "Nenhuma foto selecionada." };

  const currentCount = await prisma.bodyPhoto.count({
    where: { userId, weeklyCheckinId: checkinId },
  });
  const remainingSlots = Math.max(0, MAX_BODY_PHOTOS_PER_CHECKIN - currentCount);
  if (!remainingSlots) return { ok: false, message: "Este check-in já tem 8 fotos." };

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
  if (!data.length) return { ok: false, message: "As fotos precisam ser imagens com até 5 MB cada." };

  await prisma.bodyPhoto.createMany({ data });
  const ignored = Math.max(0, validFiles.length - data.length);
  const overLimit = Math.max(0, validFiles.length - remainingSlots);
  const details = [
    `${data.length} foto${data.length === 1 ? "" : "s"} anexada${data.length === 1 ? "" : "s"}.`,
    ignored ? `${ignored} arquivo${ignored === 1 ? "" : "s"} ignorado${ignored === 1 ? "" : "s"} por tipo/tamanho.` : "",
    overLimit ? `${overLimit} excedente${overLimit === 1 ? "" : "s"} acima do limite de 8.` : "",
  ].filter(Boolean).join(" ");

  return { ok: true, message: details };
}
