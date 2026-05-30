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

type SnapshotBodyComposition = {
  weightKg: number;
  neckCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  bodyFatPct?: number | null;
  leanMassKg?: number | null;
  fatMassKg?: number | null;
  limitation?: string | null;
};

export type BodyMeasurementState = {
  weightKg: number;
  neckCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  bodyFatPct?: number | null;
  leanMassKg?: number | null;
  fatMassKg?: number | null;
};

export function recalculateBodyCompositionSnapshot<T extends SnapshotBodyComposition>(
  snapshot: T,
  input: { sex: Sex; heightCm: number },
): T {
  const bodyFat = estimateBodyFat({
    sex: input.sex,
    heightCm: input.heightCm,
    neckCm: snapshot.neckCm,
    waistCm: snapshot.waistCm,
    hipCm: snapshot.hipCm,
  });

  if (bodyFat.percentage == null) return snapshot;

  return {
    ...snapshot,
    bodyFatPct: bodyFat.percentage,
    leanMassKg: round(snapshot.weightKg * (1 - bodyFat.percentage / 100)),
    fatMassKg: round(snapshot.weightKg * (bodyFat.percentage / 100)),
    limitation: bodyFat.limitation,
  };
}

export function recalculateBodyCompositionSnapshots<T extends SnapshotBodyComposition>(
  snapshots: T[],
  input: { sex: Sex; heightCm: number },
) {
  return snapshots.map((snapshot) => recalculateBodyCompositionSnapshot(snapshot, input));
}

export function bodyStateFromLatestSnapshot(
  profile: BodyMeasurementState,
  snapshots: BodyMeasurementState[],
): BodyMeasurementState {
  const latest = snapshots[0];
  if (!latest) return profile;

  return {
    weightKg: latest.weightKg,
    neckCm: latest.neckCm ?? profile.neckCm,
    waistCm: latest.waistCm ?? profile.waistCm,
    hipCm: latest.hipCm ?? profile.hipCm,
    bodyFatPct: latest.bodyFatPct,
    leanMassKg: latest.leanMassKg,
    fatMassKg: latest.fatMassKg,
  };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
