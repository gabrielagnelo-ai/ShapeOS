"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endOfToday, startOfToday } from "@/lib/profile";

export async function addFoodLogAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const foodId = String(formData.get("foodId") ?? "");
  const grams = Number(String(formData.get("grams") ?? "").replace(",", "."));
  const mealName = String(formData.get("mealName") ?? "Refeicao");
  if (!foodId || !Number.isFinite(grams) || grams <= 0) return;

  let log = await prisma.foodLog.findFirst({
    where: { userId: user.id, date: { gte: startOfToday(), lte: endOfToday() } },
  });

  log ??= await prisma.foodLog.create({ data: { userId: user.id, date: startOfToday() } });

  await prisma.foodLogItem.create({ data: { foodLogId: log.id, foodId, mealName, grams } });
  revalidatePath("/diario");
  revalidatePath("/dashboard");
}

export async function deleteFoodLogItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.foodLogItem.deleteMany({
    where: { id: String(formData.get("itemId") ?? ""), foodLog: { userId: user.id } },
  });
  revalidatePath("/diario");
}
