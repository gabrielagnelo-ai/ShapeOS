"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createBodyCompositionSnapshot } from "@/lib/body-composition";
import { prisma } from "@/lib/prisma";

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
