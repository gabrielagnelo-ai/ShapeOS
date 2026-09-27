"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { diaryDate, parseDiaryEntry } from "@/lib/diary-input";
import { prisma } from "@/lib/prisma";


export type DiaryActionState = { error?: string; success?: string };

export async function addFoodLogAction(_state: DiaryActionState, formData: FormData): Promise<DiaryActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sua sessão terminou. Entre novamente para registrar." };
  const entry = parseDiaryEntry(formData);
  if (entry.error) return { error: entry.error };
  const food = await prisma.food.findFirst({ where: { id: entry.foodId, OR: [{ createdByUserId: null }, { createdByUserId: user.id }] }, select: { id: true } });
  if (!food) return { error: "Este alimento não está disponível. Selecione outro." };
  try {
    await prisma.$transaction(async (tx) => {
      const log = await tx.foodLog.upsert({ where: { userId_date: { userId: user.id, date: entry.date } }, create: { userId: user.id, date: entry.date }, update: {}, select: { id: true } });
      await tx.foodLogItem.create({ data: { foodLogId: log.id, foodId: food.id, mealName: entry.mealName, grams: entry.grams } });
    });
  } catch { return { error: "Não foi possível salvar. Seus campos foram mantidos; tente novamente." }; }
  revalidateDiaryData();
  return { success: "Alimento registrado no dia selecionado." };
}

export async function updateFoodLogItemAction(_state: DiaryActionState, formData: FormData): Promise<DiaryActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sua sessão terminou. Entre novamente." };
  const entry = parseDiaryEntry(formData);
  if (entry.error) return { error: entry.error };
  const id = String(formData.get("itemId") ?? "");
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.foodLogItem.findFirst({ where: { id, foodLog: { userId: user.id } }, select: { foodId: true } });
      if (!item || item.foodId !== entry.foodId) return false;
      const log = await tx.foodLog.upsert({ where: { userId_date: { userId: user.id, date: entry.date } }, create: { userId: user.id, date: entry.date }, update: {}, select: { id: true } });
      // Keep meal provenance even when its portion/date is edited. Clearing it
      // would leave an orphan duplicate when that meal is registered again.
      await tx.foodLogItem.update({ where: { id }, data: { grams: entry.grams, mealName: entry.mealName, foodLogId: log.id } });
      return true;
    });
    if (!updated) return { error: "Registro não encontrado. Atualize a página." };
  } catch { return { error: "Não foi possível salvar a alteração. Tente novamente." }; }
  revalidateDiaryData();
  return { success: "Registro atualizado." };
}

export async function deleteFoodLogItemAction(_state: DiaryActionState, formData: FormData): Promise<DiaryActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sua sessão terminou. Entre novamente." };
  if (formData.get("confirmDelete") !== "on") return { error: "Confirme a remoção do registro." };
  try {
    const result = await prisma.foodLogItem.deleteMany({ where: { id: String(formData.get("itemId") ?? ""), foodLog: { userId: user.id } } });
    if (!result.count) return { error: "Registro não encontrado. Atualize a página." };
  } catch {
    return { error: "Não foi possível remover o registro. Tente novamente." };
  }
  revalidateDiaryData();
  return { success: "Registro removido." };
}

export async function registerDietMealAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const date = diaryDate(String(formData.get("date") ?? ""));
  if (!date) redirect("/diario?status=invalid-date");
  const mealId = String(formData.get("mealId") ?? "");
  if (!mealId) return;

  const meal = await prisma.dietMeal.findFirst({
    where: { id: mealId, dietPlan: { userId: user.id, isActive: true } },
    include: { items: { select: { foodId: true, grams: true } } },
  });
  if (!meal?.items.length) return;

  let failed = false;
  try {
    await prisma.$transaction(async (tx) => {
      // The explicit update obtains a lock on this user's day until commit.
      // Concurrent submissions then replace the meal serially, even if it was
      // previously empty (locking only its food items would not cover that case).
      const log = await tx.foodLog.upsert({
        where: { userId_date: { userId: user.id, date } },
        create: { userId: user.id, date },
        update: { date },
        select: { id: true },
      });
      await tx.foodLogItem.deleteMany({ where: { foodLogId: log.id, sourceDietMealId: meal.id } });
      await tx.foodLogItem.createMany({
        data: meal.items.map((item) => ({
          foodLogId: log.id,
          foodId: item.foodId,
          mealName: meal.name,
          grams: item.grams,
          sourceDietMealId: meal.id,
        })),
      });
    });
  } catch { failed = true; }
  if (failed) redirect(`/diario?data=${encodeURIComponent(String(formData.get("date")))}&status=save-failed`);

  revalidateDiaryData();
}

export async function unregisterDietMealAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const date = diaryDate(String(formData.get("date") ?? ""));
  if (!date) redirect("/diario?status=invalid-date");
  const mealId = String(formData.get("mealId") ?? "");
  if (!mealId) return;

  const meal = await prisma.dietMeal.findFirst({
    where: { id: mealId, dietPlan: { userId: user.id } },
    select: { id: true },
  });
  if (!meal) return;

  await prisma.foodLogItem.deleteMany({
    where: {
      sourceDietMealId: meal.id,
      foodLog: { userId: user.id, date },
    },
  });

  revalidateDiaryData();
}

function revalidateDiaryData() {
  revalidatePath("/diario");
  revalidatePath("/dashboard");
  revalidatePath("/relatorio-nutricionista");
}
