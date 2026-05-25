"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfToday } from "@/lib/profile";

export async function addWaterLogAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const amountMl = Number(String(formData.get("amountMl") ?? "").replace(",", "."));
  if (!Number.isFinite(amountMl) || amountMl <= 0) return;

  await prisma.waterLog.create({
    data: {
      userId: user.id,
      date: startOfToday(),
      amountMl: Math.min(2000, Math.round(amountMl)),
    },
  });

  revalidatePath("/dashboard");
}
