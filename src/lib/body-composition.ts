import { prisma } from "@/lib/prisma";
import { estimateBodyFat, type Sex } from "@/lib/nutrition";

type SnapshotInput = {
  userId: string;
  source: "onboarding" | "profile_update" | "weekly_checkin";
  sex: Sex;
  heightCm: number;
  weightKg: number;
  neckCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  measuredAt?: Date;
};

export async function createBodyCompositionSnapshot(input: SnapshotInput) {
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) return;

  const bodyFat = estimateBodyFat({
    sex: input.sex,
    heightCm: input.heightCm,
    neckCm: input.neckCm,
    waistCm: input.waistCm,
    hipCm: input.hipCm,
  });
  const leanMassKg = bodyFat.percentage == null ? null : round(input.weightKg * (1 - bodyFat.percentage / 100));
  const fatMassKg = bodyFat.percentage == null ? null : round(input.weightKg * (bodyFat.percentage / 100));

  await prisma.bodyCompositionSnapshot.create({
    data: {
      userId: input.userId,
      source: input.source,
      measuredAt: input.measuredAt ?? new Date(),
      weightKg: round(input.weightKg),
      neckCm: input.neckCm ?? null,
      waistCm: input.waistCm ?? null,
      hipCm: input.hipCm ?? null,
      bodyFatPct: bodyFat.percentage,
      leanMassKg,
      fatMassKg,
      limitation: bodyFat.limitation,
    },
  });
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
