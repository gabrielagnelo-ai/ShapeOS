"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recommendedSupplementDose, type SupplementProtocol, type SupplementType } from "@/lib/supplements";

const supplementTypes = ["CREATINE", "BETA_ALANINE"];
const protocols = ["LOADING", "STEADY"];

export async function createSupplementPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const type = normalizeEnum(String(formData.get("type") ?? ""), supplementTypes, "CREATINE") as SupplementType;
  const protocol = normalizeEnum(String(formData.get("protocol") ?? ""), protocols, "STEADY") as SupplementProtocol;
  const dailyDoseG = parsePositiveNumber(formData.get("dailyDoseG")) ?? recommendedSupplementDose(type, protocol);
  const startedAt = parseDate(String(formData.get("startedAt") ?? "")) ?? new Date();
  const notes = String(formData.get("notes") ?? "").trim();

  await prisma.supplementPlan.create({
    data: {
      userId: user.id,
      type,
      protocol,
      name: type === "CREATINE" ? "Creatina" : "Beta-alanina",
      dailyDoseG,
      startedAt,
      notes: notes || null,
    },
  });

  revalidatePath("/suplementos");
  revalidatePath("/dashboard");
}

export async function logSupplementDoseAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const planId = String(formData.get("planId") ?? "");
  const doseG = parsePositiveNumber(formData.get("doseG"));
  const date = parseDate(String(formData.get("date") ?? "")) ?? startOfToday();
  if (!planId || !doseG) return;

  const plan = await prisma.supplementPlan.findFirst({ where: { id: planId, userId: user.id }, select: { id: true } });
  if (!plan) return;

  await prisma.supplementLog.upsert({
    where: { planId_date: { planId: plan.id, date } },
    create: { planId: plan.id, date, doseG },
    update: { doseG },
  });

  revalidatePath("/suplementos");
  revalidatePath("/dashboard");
}

export async function archiveSupplementPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.supplementPlan.updateMany({
    where: { id: String(formData.get("planId") ?? ""), userId: user.id },
    data: { isActive: false },
  });

  revalidatePath("/suplementos");
  revalidatePath("/dashboard");
}

function normalizeEnum(value: string, allowed: string[], fallback: string) {
  return allowed.includes(value) ? value : fallback;
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
