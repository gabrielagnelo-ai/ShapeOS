import type { NextRequest } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api-auth";
import { generateCoachInsights } from "@/lib/coach";
import { buildCoachContext, hasEnoughCoachData } from "@/lib/coach/context";
import { prisma } from "@/lib/prisma";
import { computeCurrentProfileMetrics } from "@/lib/profile";

const goals = { FAT_LOSS: "fat_loss", MAINTENANCE: "maintenance", MUSCLE_GAIN: "muscle_gain" } as const;

export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) return Response.json({ error: "profile_required" }, { status: 409 });
  const [{ metrics }, foodLogs, checkins] = await Promise.all([
    computeCurrentProfileMetrics(user.id, profile),
    prisma.foodLog.findMany({ where: { userId: user.id }, include: { items: { include: { food: true } } }, orderBy: { date: "desc" }, take: 7 }),
    prisma.weeklyCheckin.findMany({ where: { userId: user.id }, orderBy: { weekStart: "desc" }, take: 8 }),
  ]);
  const context = buildCoachContext({ goal: goals[profile.goal], tdee: metrics.tdee, targetCalories: metrics.targets.calories, proteinTargetG: metrics.targets.proteinG, foodLogs, checkins });
  const insights = hasEnoughCoachData(context) ? generateCoachInsights(context) : [];
  return Response.json({
    source: "rules",
    briefing: insights[0]?.message ?? "Continue registrando alimentação e check-ins para acompanhar seus sinais.",
    insights,
  });
}
