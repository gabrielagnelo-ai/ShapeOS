import { prisma } from "@/lib/prisma";

export function normalizeFoodQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function findFoodByQuery(query: string) {
  const normalized = query.trim();
  if (!normalized) return null;

  const exact = await prisma.food.findFirst({
    where: { name: { equals: normalized, mode: "insensitive" } },
    select: { id: true },
  });
  if (exact) return exact;

  const contains = await prisma.food.findFirst({
    where: { name: { contains: normalized, mode: "insensitive" } },
    orderBy: [{ source: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  if (contains) return contains;

  const terms = normalizeFoodQuery(normalized).split(" ").filter((term) => term.length > 2).slice(0, 4);
  if (!terms.length) return null;

  return prisma.food.findFirst({
    where: {
      AND: terms.map((term) => ({
        name: { contains: term, mode: "insensitive" as const },
      })),
    },
    orderBy: [{ source: "asc" }, { name: "asc" }],
    select: { id: true },
  });
}
