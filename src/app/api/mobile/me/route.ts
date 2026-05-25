import { type NextRequest } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics } from "@/lib/profile";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  const metrics = profile ? computeProfileMetrics(profile) : null;

  return Response.json({
    user: { id: user.id, name: user.name, email: user.email },
    profile,
    metrics: metrics
      ? {
          bmr: metrics.bmr,
          tdee: metrics.tdee,
          bmi: metrics.bmi,
          bodyFat: metrics.bodyFat,
          targets: metrics.targets,
          micronutrientTargets: metrics.micronutrientTargets,
        }
      : null,
  });
}
