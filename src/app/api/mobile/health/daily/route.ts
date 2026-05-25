import { type NextRequest } from "next/server";
import { z } from "zod";
import { getApiUser, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

const dailyHealthSchema = z.object({
  date: z.string().min(8),
  steps: z.number().int().min(0).optional(),
  activeEnergyKcal: z.number().min(0).optional(),
  restingEnergyKcal: z.number().min(0).optional(),
  workoutMinutes: z.number().int().min(0).optional(),
  sleepMinutes: z.number().int().min(0).optional(),
  restingHeartRateBpm: z.number().int().min(20).max(240).optional(),
  averageHeartRateBpm: z.number().int().min(20).max(240).optional(),
  source: z.string().min(1).max(80).default("apple_health"),
});

export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const { prisma } = await import("@/lib/prisma");
  const parsed = dailyHealthSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const date = normalizeDay(parsed.data.date);
  const totalEnergyKcal = sumOptional(parsed.data.activeEnergyKcal, parsed.data.restingEnergyKcal);

  const summary = await prisma.healthDailySummary.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: {
      userId: user.id,
      date,
      steps: parsed.data.steps,
      activeEnergyKcal: parsed.data.activeEnergyKcal,
      restingEnergyKcal: parsed.data.restingEnergyKcal,
      totalEnergyKcal,
      workoutMinutes: parsed.data.workoutMinutes,
      sleepMinutes: parsed.data.sleepMinutes,
      restingHeartRateBpm: parsed.data.restingHeartRateBpm,
      averageHeartRateBpm: parsed.data.averageHeartRateBpm,
      source: parsed.data.source,
      syncedAt: new Date(),
    },
    update: {
      steps: parsed.data.steps,
      activeEnergyKcal: parsed.data.activeEnergyKcal,
      restingEnergyKcal: parsed.data.restingEnergyKcal,
      totalEnergyKcal,
      workoutMinutes: parsed.data.workoutMinutes,
      sleepMinutes: parsed.data.sleepMinutes,
      restingHeartRateBpm: parsed.data.restingHeartRateBpm,
      averageHeartRateBpm: parsed.data.averageHeartRateBpm,
      source: parsed.data.source,
      syncedAt: new Date(),
    },
  });

  return Response.json({ summary });
}

function normalizeDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function sumOptional(a?: number, b?: number) {
  if (typeof a !== "number" && typeof b !== "number") return undefined;
  return (a ?? 0) + (b ?? 0);
}
