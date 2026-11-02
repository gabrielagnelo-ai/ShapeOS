"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { MAX_MENU_ENTRIES, menuIdsWithout, nextMenuEntryOrder, parseMenuDirection, parseMenuEntryDays, reorderMenuEntryIds } from "@/lib/diet-menu";
import { prisma } from "@/lib/prisma";

/** Result shown next to the control that sent it. `at` makes every result a new one. */
export type MenuActionState = { ok: boolean; message: string; at: number } | null;

/** `refresh` re-renders the page even on a failure (the list on screen may be stale). */
function result(ok: boolean, message: string, refresh = ok): MenuActionState {
  if (refresh) revalidatePath("/dieta");
  return { ok, message, at: Date.now() };
}

const NOT_FOUND = "Esse item não está mais no cardápio. A lista foi atualizada.";
const INVALID_DAYS = "Use um número inteiro de 1 a 90.";
const FULL = `O cardápio aceita até ${MAX_MENU_ENTRIES} planos. Remova um antes de adicionar outro.`;

type Tx = Prisma.TransactionClient;

class MenuConflict extends Error {}

function isRecordGone(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return error instanceof MenuConflict || code === "P2025";
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?erro=Sessão não encontrada. Entre novamente.");
  return user;
}

/**
 * Locks the user's menu row until the transaction ends, so every write that reads the list
 * (limit, order, reorder, compaction) runs one at a time per menu. Returns null without a menu.
 */
async function lockMenu(tx: Tx, userId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM diet_menus WHERE user_id = ${userId} FOR UPDATE`;
  return rows[0]?.id ?? null;
}

/** Entry ids of the locked menu, in order; only entries whose plan also belongs to the user. */
async function lockedEntryIds(tx: Tx, menuId: string, userId: string) {
  const entries = await tx.dietMenuEntry.findMany({
    where: { menuId, dietPlan: { userId } },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return entries.map((entry) => entry.id);
}

async function rewriteOrder(tx: Tx, ids: string[]) {
  for (const [order, id] of ids.entries()) await tx.dietMenuEntry.update({ where: { id }, data: { order } });
}

/** Creates the menu row once; a concurrent first add may win the unique user_id, which is fine. */
async function ensureMenu(userId: string) {
  try {
    await prisma.dietMenu.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } });
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code !== "P2002") throw error;
  }
}

export async function addDietMenuEntryAction(_previous: MenuActionState, formData: FormData): Promise<MenuActionState> {
  const user = await requireUser();
  const days = parseMenuEntryDays(formData.get("days"));
  if (days == null) return result(false, INVALID_DAYS);

  const planId = String(formData.get("planId") ?? "");
  const plan = planId ? await prisma.dietPlan.findFirst({ where: { id: planId, userId: user.id }, select: { id: true, name: true } }) : null;
  if (!plan) return result(false, "Escolha um dos seus planos para adicionar.");

  await ensureMenu(user.id);
  const added = await prisma.$transaction(async (tx) => {
    const menuId = await lockMenu(tx, user.id);
    if (!menuId) return false;
    const existing = await tx.dietMenuEntry.findMany({ where: { menuId }, select: { order: true } });
    const order = nextMenuEntryOrder(existing.map((entry) => entry.order));
    if (order == null) return false;
    await tx.dietMenuEntry.create({ data: { menuId, dietPlanId: plan.id, days, order } });
    await tx.dietMenu.update({ where: { id: menuId }, data: { updatedAt: new Date() } });
    return true;
  });
  if (!added) return result(false, FULL, true);
  return result(true, `${plan.name} adicionado por ${days} ${days === 1 ? "dia" : "dias"}.`);
}

export async function updateDietMenuEntryDaysAction(_previous: MenuActionState, formData: FormData): Promise<MenuActionState> {
  const user = await requireUser();
  const days = parseMenuEntryDays(formData.get("days"));
  if (days == null) return result(false, INVALID_DAYS);

  const entryId = String(formData.get("entryId") ?? "");
  // One statement, so it needs no lock: it either finds the user's entry or changes nothing.
  const { count } = await prisma.dietMenuEntry.updateMany({
    where: { id: entryId, menu: { userId: user.id }, dietPlan: { userId: user.id } },
    data: { days },
  });
  if (!count) return result(false, NOT_FOUND, true);
  return result(true, "Dias salvos.");
}

export async function moveDietMenuEntryAction(_previous: MenuActionState, formData: FormData): Promise<MenuActionState> {
  const user = await requireUser();
  const direction = parseMenuDirection(formData.get("direction"));
  const entryId = String(formData.get("entryId") ?? "");
  if (!direction) return result(false, NOT_FOUND, true);

  try {
    await prisma.$transaction(async (tx) => {
      const menuId = await lockMenu(tx, user.id);
      if (!menuId) throw new MenuConflict();
      const next = reorderMenuEntryIds(await lockedEntryIds(tx, menuId, user.id), entryId, direction);
      if (!next) throw new MenuConflict();
      await rewriteOrder(tx, next);
    });
  } catch (error) {
    if (isRecordGone(error)) return result(false, NOT_FOUND, true);
    throw error;
  }
  return result(true, direction === "up" ? "Movido para cima." : "Movido para baixo.");
}

export async function removeDietMenuEntryAction(_previous: MenuActionState, formData: FormData): Promise<MenuActionState> {
  const user = await requireUser();
  const entryId = String(formData.get("entryId") ?? "");

  try {
    await prisma.$transaction(async (tx) => {
      const menuId = await lockMenu(tx, user.id);
      if (!menuId) throw new MenuConflict();
      const remaining = menuIdsWithout(await lockedEntryIds(tx, menuId, user.id), entryId);
      if (!remaining) throw new MenuConflict();
      await tx.dietMenuEntry.delete({ where: { id: entryId } });
      await rewriteOrder(tx, remaining);
    });
  } catch (error) {
    if (isRecordGone(error)) return result(false, NOT_FOUND, true);
    throw error;
  }
  return result(true, "Plano removido do cardápio.");
}
