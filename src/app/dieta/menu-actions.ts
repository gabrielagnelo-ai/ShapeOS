"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { MAX_MENU_ENTRIES, parseMenuDirection, parseMenuEntryDays, reorderMenuEntryIds } from "@/lib/diet-menu";
import { prisma } from "@/lib/prisma";

/** Result shown next to the control that sent it. `at` makes every result a new one. */
export type MenuActionState = { ok: boolean; message: string; at: number } | null;

function result(ok: boolean, message: string): MenuActionState {
  if (ok) revalidatePath("/dieta");
  return { ok, message, at: Date.now() };
}

const NOT_FOUND = "Esse item não está mais no cardápio. A lista foi atualizada.";
const INVALID_DAYS = "Use um número inteiro de 1 a 90.";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?erro=Sessão não encontrada. Entre novamente.");
  return user;
}

/** Entries of the signed-in user's menu, in order. Ownership is enforced by the menu's userId. */
async function ownedEntryIds(userId: string) {
  const entries = await prisma.dietMenuEntry.findMany({
    where: { menu: { userId } },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return entries.map((entry) => entry.id);
}

async function rewriteOrder(ids: string[]) {
  await prisma.$transaction(ids.map((id, order) => prisma.dietMenuEntry.update({ where: { id }, data: { order } })));
}

export async function addDietMenuEntryAction(_previous: MenuActionState, formData: FormData): Promise<MenuActionState> {
  const user = await requireUser();
  const days = parseMenuEntryDays(formData.get("days"));
  if (days == null) return result(false, INVALID_DAYS);

  const planId = String(formData.get("planId") ?? "");
  const plan = planId ? await prisma.dietPlan.findFirst({ where: { id: planId, userId: user.id }, select: { id: true, name: true } }) : null;
  if (!plan) return result(false, "Escolha um dos seus planos para adicionar.");

  const menu = await prisma.dietMenu.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
    select: { id: true, _count: { select: { entries: true } } },
  });
  if (menu._count.entries >= MAX_MENU_ENTRIES) return result(false, `O cardápio aceita até ${MAX_MENU_ENTRIES} planos. Remova um antes de adicionar outro.`);

  const last = await prisma.dietMenuEntry.findFirst({ where: { menuId: menu.id }, orderBy: { order: "desc" }, select: { order: true } });
  await prisma.$transaction([
    prisma.dietMenuEntry.create({ data: { menuId: menu.id, dietPlanId: plan.id, days, order: (last?.order ?? -1) + 1 } }),
    prisma.dietMenu.update({ where: { id: menu.id }, data: { updatedAt: new Date() } }),
  ]);
  return result(true, `${plan.name} adicionado por ${days} ${days === 1 ? "dia" : "dias"}.`);
}

export async function updateDietMenuEntryDaysAction(_previous: MenuActionState, formData: FormData): Promise<MenuActionState> {
  const user = await requireUser();
  const days = parseMenuEntryDays(formData.get("days"));
  if (days == null) return result(false, INVALID_DAYS);

  const entryId = String(formData.get("entryId") ?? "");
  const { count } = await prisma.dietMenuEntry.updateMany({ where: { id: entryId, menu: { userId: user.id } }, data: { days } });
  if (!count) return result(true, NOT_FOUND);
  return result(true, "Dias salvos.");
}

export async function moveDietMenuEntryAction(_previous: MenuActionState, formData: FormData): Promise<MenuActionState> {
  const user = await requireUser();
  const direction = parseMenuDirection(formData.get("direction"));
  const entryId = String(formData.get("entryId") ?? "");
  if (!direction) return result(true, NOT_FOUND);

  const next = reorderMenuEntryIds(await ownedEntryIds(user.id), entryId, direction);
  if (!next) return result(true, NOT_FOUND);
  await rewriteOrder(next);
  return result(true, direction === "up" ? "Movido para cima." : "Movido para baixo.");
}

export async function removeDietMenuEntryAction(_previous: MenuActionState, formData: FormData): Promise<MenuActionState> {
  const user = await requireUser();
  const entryId = String(formData.get("entryId") ?? "");
  const { count } = await prisma.dietMenuEntry.deleteMany({ where: { id: entryId, menu: { userId: user.id } } });
  if (!count) return result(true, NOT_FOUND);

  await rewriteOrder(await ownedEntryIds(user.id));
  return result(true, "Plano removido do cardápio.");
}
