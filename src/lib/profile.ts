import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endOfTodayInAppTimeZone, startOfTodayInAppTimeZone } from "@/lib/date-time";
import {
  bodyStateFromLatestSnapshot,
  recalculateBodyCompositionSnapshot,
} from "@/lib/body-composition";
import { computeProfileMetrics } from "@/lib/profile-metrics";

// The pure rule lives in profile-metrics.ts (no database or session), re-exported here.
export { computeProfileMetrics, dailyTargets } from "@/lib/profile-metrics";

export async function requireUserProfile() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?erro=Sessão não encontrada. Entre novamente.");

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

  return { user, profile };
}

export async function computeCurrentProfileMetrics(
  userId: string,
  profile: Awaited<ReturnType<typeof requireUserProfile>>["profile"],
) {
  const baseMetrics = computeProfileMetrics(profile);
  const latestSnapshot = await prisma.bodyCompositionSnapshot.findFirst({
    where: { userId },
    orderBy: { measuredAt: "desc" },
  });

  if (!latestSnapshot) {
    return { metrics: baseMetrics, currentBody: profile };
  }

  const recalculatedSnapshot = recalculateBodyCompositionSnapshot(latestSnapshot, {
    sex: baseMetrics.sex,
    heightCm: profile.heightCm,
  });
  const currentBody = bodyStateFromLatestSnapshot(profile, [recalculatedSnapshot]);

  return {
    metrics: computeProfileMetrics(profile, currentBody),
    currentBody,
  };
}

export function startOfToday() {
  return startOfTodayInAppTimeZone();
}

export function endOfToday() {
  return endOfTodayInAppTimeZone();
}
