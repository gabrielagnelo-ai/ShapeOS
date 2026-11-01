"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { MAX_MENU_ENTRIES, parseMenuDirection, parseMenuEntryDays, reorderMenuEntryIds } from "@/lib/diet-menu";
import { prisma } from "@/lib/prisma";

const MENU_URL = "/dieta?cardapio=";

function done(status: string): never {
  revalidatePath("/dieta");
  redirect(`${MENU_URL}${status}#cardapio`);
}

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

export async function addDietMenuEntryAction(formData: FormData) {
  const user = await requireUser();
  const days = parseMenuEntryDays(formData.get("days"));
  if (days == null) done("invalid-days");

  const planId = String(formData.get("planId") ?? "");
  const plan = planId ? await prisma.dietPlan.findFirst({ where: { id: planId, userId: user.id }, select: { id: true } }) : null;
  if (!plan) done("invalid-plan");

  const menu = await prisma.dietMenu.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
    select: { id: true, _count: { select: { entries: true } } },
  });
  if (menu._count.entries >= MAX_MENU_ENTRIES) done("full");

  const last = await prisma.dietMenuEntry.findFirst({ where: { menuId: menu.id }, orderBy: { order: "desc" }, select: { order: true } });
  await prisma.$transaction([
    prisma.dietMenuEntry.create({ data: { menuId: menu.id, dietPlanId: plan.id, days, order: (last?.order ?? -1) + 1 } }),
    prisma.dietMenu.update({ where: { id: menu.id }, data: { updatedAt: new Date() } }),
  ]);
  done("added");
}

export async function updateDietMenuEntryDaysAction(formData: FormData) {
  const user = await requireUser();
  const days = parseMenuEntryDays(formData.get("days"));
  if (days == null) done("invalid-days");

  const entryId = String(formData.get("entryId") ?? "");
  const { count } = await prisma.dietMenuEntry.updateMany({ where: { id: entryId, menu: { userId: user.id } }, data: { days } });
  if (!count) done("not-found");
  done("days");
}

export async function moveDietMenuEntryAction(formData: FormData) {
  const user = await requireUser();
  const direction = parseMenuDirection(formData.get("direction"));
  const entryId = String(formData.get("entryId") ?? "");
  if (!direction) done("not-found");

  const next = reorderMenuEntryIds(await ownedEntryIds(user.id), entryId, direction);
  if (!next) done("not-found");
  await rewriteOrder(next);
  done("moved");
}

export async function removeDietMenuEntryAction(formData: FormData) {
  const user = await requireUser();
  const entryId = String(formData.get("entryId") ?? "");
  const { count } = await prisma.dietMenuEntry.deleteMany({ where: { id: entryId, menu: { userId: user.id } } });
  if (!count) done("not-found");

  await rewriteOrder(await ownedEntryIds(user.id));
  done("removed");
}
