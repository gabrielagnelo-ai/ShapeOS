"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { parseAppDate, startOfTodayInAppTimeZone } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";
import { recommendedSupplementDose, supplementDisplayName, supplementNutrientDefinitions, type SupplementProtocol, type SupplementType } from "@/lib/supplements";

const supplementTypes = ["CREATINE", "BETA_ALANINE", "MULTIVITAMIN"];
const protocols = ["LOADING", "STEADY"];

export async function createSupplementPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const type = normalizeEnum(String(formData.get("type") ?? ""), supplementTypes, "CREATINE") as SupplementType;
  const selectedProtocol = normalizeEnum(String(formData.get("protocol") ?? ""), protocols, "STEADY") as SupplementProtocol;
  const protocol = type === "MULTIVITAMIN" ? "STEADY" : selectedProtocol;
  const dailyDoseG = parsePositiveNumber(formData.get("dailyDoseG")) ?? recommendedSupplementDose(type, protocol);
  const startedAt = parseDate(String(formData.get("startedAt") ?? "")) ?? new Date();
  const notes = String(formData.get("notes") ?? "").trim();
  const customName = String(formData.get("name") ?? "").trim();
  const micronutrientsPerDose = type === "MULTIVITAMIN" ? readMicronutrients(formData) : undefined;

  await prisma.supplementPlan.create({
    data: {
      userId: user.id,
      type,
      protocol,
      name: customName || supplementDisplayName(type),
      dailyDoseG,
      startedAt,
      notes: notes || null,
      micronutrientsPerDose,
    },
  });

  revalidatePath("/suplementos");
  revalidatePath("/dashboard");
  revalidatePath("/diario");
}

export async function updateMultivitaminLabelAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const planId = String(formData.get("planId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const dailyDoseG = parsePositiveNumber(formData.get("dailyDoseG"));
  if (!planId || !name || !dailyDoseG) return;

  await prisma.supplementPlan.updateMany({
    where: { id: planId, userId: user.id, type: "MULTIVITAMIN" },
    data: {
      name,
      dailyDoseG,
      micronutrientsPerDose: readMicronutrients(formData),
    },
  });

  revalidatePath("/suplementos");
  revalidatePath("/diario");
  revalidatePath("/relatorio-nutricionista");
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
  revalidatePath("/diario");
}

export async function addSupplementUsagePeriodAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const planId = String(formData.get("planId") ?? "");
  const startDate = parseDate(String(formData.get("startDate") ?? ""));
  const endDate = parseDate(String(formData.get("endDate") ?? ""));
  const dailyDoseG = parsePositiveNumber(formData.get("dailyDoseG"));
  const adherencePct = clamp(parsePositiveNumber(formData.get("adherencePct")) ?? 100, 0, 100);
  const note = String(formData.get("note") ?? "").trim();
  if (!planId || !startDate || !dailyDoseG) return;

  const plan = await prisma.supplementPlan.findFirst({ where: { id: planId, userId: user.id }, select: { id: true } });
  if (!plan) return;

  await prisma.supplementUsagePeriod.create({
    data: {
      planId: plan.id,
      startDate,
      endDate: endDate && endDate >= startDate ? endDate : null,
      dailyDoseG,
      adherencePct,
      note: note || null,
    },
  });

  revalidatePath("/suplementos");
  revalidatePath("/dashboard");
  revalidatePath("/diario");
}

export async function deleteSupplementUsagePeriodAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.supplementUsagePeriod.deleteMany({
    where: {
      id: String(formData.get("periodId") ?? ""),
      plan: { userId: user.id },
    },
  });

  revalidatePath("/suplementos");
  revalidatePath("/dashboard");
  revalidatePath("/diario");
}

export async function deleteSupplementLogAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.supplementLog.deleteMany({
    where: {
      id: String(formData.get("logId") ?? ""),
      plan: { userId: user.id },
    },
  });

  revalidatePath("/suplementos");
  revalidatePath("/dashboard");
  revalidatePath("/diario");
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
  revalidatePath("/diario");
}

export async function restoreSupplementPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.supplementPlan.updateMany({
    where: { id: String(formData.get("planId") ?? ""), userId: user.id },
    data: { isActive: true },
  });

  revalidatePath("/suplementos");
  revalidatePath("/dashboard");
  revalidatePath("/diario");
}

export async function deleteSupplementPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.supplementPlan.deleteMany({
    where: {
      id: String(formData.get("planId") ?? ""),
      userId: user.id,
    },
  });

  revalidatePath("/suplementos");
  revalidatePath("/dashboard");
  revalidatePath("/diario");
}

function normalizeEnum(value: string, allowed: string[], fallback: string) {
  return allowed.includes(value) ? value : fallback;
}

function parsePositiveNumber(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseDate(value: string) {
  return value ? parseAppDate(value) : null;
}

function startOfToday() {
  return startOfTodayInAppTimeZone();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readMicronutrients(formData: FormData) {
  return Object.fromEntries(
    supplementNutrientDefinitions.map(({ key }) => [key, parseNonNegativeNumber(formData.get(key))]),
  );
}

function parseNonNegativeNumber(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
