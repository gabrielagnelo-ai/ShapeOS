// Linha do tempo das medidas corporais e comparação entre períodos (usada pelo modelo 3D em Progresso).

export const BODY_FIELDS = ["neckCm", "chestCm", "waistCm", "hipCm", "armCm", "thighCm", "calfCm"] as const;
export type BodyField = (typeof BODY_FIELDS)[number];

// Fitas exibidas no corpo: tronco à esquerda da figura, membros à direita
export const TAPE_FIELDS = ["chestCm", "waistCm", "hipCm", "armCm", "thighCm", "calfCm"] as const;
export type TapeField = (typeof TAPE_FIELDS)[number];

export type BodyEntry = Record<BodyField, number | null> & {
  date: string;
  weightKg: number;
  bodyFatPct: number | null;
  leanMassKg: number | null;
};

type SnapshotLike = Partial<Record<BodyField, number | null>> & {
  measuredAt: Date;
  weightKg: number;
  bodyFatPct?: number | null;
  leanMassKg?: number | null;
};

// Do mais antigo ao mais recente. Medida que faltar num registro herda a anterior (ou a do perfil),
// já que nem todo check-in traz todas as circunferências.
export function buildBodyTimeline(
  profile: Partial<Record<BodyField, number | null>>,
  snapshots: SnapshotLike[],
): BodyEntry[] {
  const known: Record<BodyField, number | null> = Object.fromEntries(BODY_FIELDS.map((f) => [f, profile[f] ?? null])) as Record<BodyField, number | null>;
  return [...snapshots]
    .sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime())
    .map((snapshot) => {
      for (const field of BODY_FIELDS) known[field] = snapshot[field] ?? known[field];
      return {
        date: snapshot.measuredAt.toISOString(),
        weightKg: snapshot.weightKg,
        bodyFatPct: snapshot.bodyFatPct ?? null,
        leanMassKg: snapshot.leanMassKg ?? null,
        ...known,
      };
    });
}

export type ChangeStatus = "muscle" | "fat" | "warn" | "stable" | "unknown";
const LIMBS: TapeField[] = ["chestCm", "armCm", "thighCm", "calfCm"];

// Aumento em peito/braço/coxa/panturrilha = massa magra; redução = gordura,
// a menos que a massa magra total tenha caído (aí redução nos membros vira alerta).
// Aumento de cintura ou quadril é sempre alerta.
export function classifyChange(field: TapeField, delta: number | null, leanDelta: number | null): ChangeStatus {
  if (delta == null) return "unknown";
  if (Math.abs(delta) < 0.3) return "stable";
  const limb = LIMBS.includes(field);
  if (delta > 0) return limb ? "muscle" : "warn";
  return limb && leanDelta != null && leanDelta < 0 ? "warn" : "fat";
}

export type BodyComparison = {
  current: BodyEntry;
  before: BodyEntry | null;
  days: number | null;
  deltas: Record<TapeField, number | null>;
  statuses: Record<TapeField, ChangeStatus>;
  weightDelta: number | null;
  bodyFatDelta: number | null;
  leanDelta: number | null;
};

const DAY = 24 * 60 * 60 * 1000;
const diff = (a: number | null, b: number | null) => (a == null || b == null ? null : Math.round((a - b) * 10) / 10);

// Compara o registro mais recente com o último registro feito até `periodDays` antes dele.
// Sem registro tão antigo, usa o mais antigo disponível.
export function compareBody(timeline: BodyEntry[], periodDays: number): BodyComparison | null {
  const current = timeline[timeline.length - 1];
  if (!current) return null;
  const limit = new Date(current.date).getTime() - periodDays * DAY;
  const older = timeline.slice(0, -1);
  const before = [...older].reverse().find((entry) => new Date(entry.date).getTime() <= limit) ?? older[0] ?? null;
  const leanDelta = before ? diff(current.leanMassKg, before.leanMassKg) : null;
  const deltas = Object.fromEntries(TAPE_FIELDS.map((f) => [f, before ? diff(current[f], before[f]) : null])) as Record<TapeField, number | null>;
  return {
    current,
    before,
    days: before ? Math.round((new Date(current.date).getTime() - new Date(before.date).getTime()) / DAY) : null,
    deltas,
    statuses: Object.fromEntries(TAPE_FIELDS.map((f) => [f, before ? classifyChange(f, deltas[f], leanDelta) : "unknown"])) as Record<TapeField, ChangeStatus>,
    weightDelta: before ? diff(current.weightKg, before.weightKg) : null,
    bodyFatDelta: before ? diff(current.bodyFatPct, before.bodyFatPct) : null,
    leanDelta,
  };
}
