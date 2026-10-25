import { PageHeading } from "@/components/ui/page-heading";
import { Hero, Section, Stack } from "@/components/ui/screen";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { IconTile } from "@/components/ui/group";
import { activityEfforts, activityPresets, tdeeCheck } from "@/lib/activity";
import { bodyStateFromLatestSnapshot, recalculateBodyCompositionSnapshots } from "@/lib/body-composition";
import { appDateInputValue } from "@/lib/date-time";
import type { Sex } from "@/lib/nutrition";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics, endOfToday, requireUserProfile, startOfToday } from "@/lib/profile";
import { effectiveTdee, tdeeInflationWarning } from "@/lib/tdee";
import { deletePhysicalActivityAction } from "./actions";
import { ActivityForm } from "./activity-form";
import { formatNumber } from "@/lib/common";

const sexMap = { MALE: "male", FEMALE: "female" } as const;

export default async function AtividadesPage() {
  const { user, profile } = await requireUserProfile();
  const today = new Date();
  const logs = await prisma.physicalActivityLog.findMany({
    where: { userId: user.id, date: { gte: startOfToday(), lte: endOfToday() } },
    orderBy: { createdAt: "desc" },
  });
  const recentLogs = await prisma.physicalActivityLog.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    take: 12,
  });
  const rawBodySnapshots = await prisma.bodyCompositionSnapshot.findMany({
    where: { userId: user.id },
    orderBy: { measuredAt: "desc" },
    take: 12,
  });
  const bodySnapshots = recalculateBodyCompositionSnapshots(rawBodySnapshots, { sex: sexMap[profile.sex] as Sex, heightCm: profile.heightCm });
  const currentBody = bodyStateFromLatestSnapshot(profile, bodySnapshots);
  const { bmr, tdee } = computeProfileMetrics(profile, currentBody);
  const tdeeResult = effectiveTdee({
    bmr,
    activityFactor: profile.activityFactor,
    adjustmentKcal: profile.tdeeAdjustmentKcal,
    mode: profile.tdeeCalculationMode,
    activities: logs,
  });
  const comparison = tdeeCheck({ estimatedTdee: tdee, loggedActivityKcal: tdeeResult.activityKcal });
  const strengthWarning = tdeeInflationWarning({
    activityFactor: profile.activityFactor,
    activityKey: "weight_training",
    mode: profile.tdeeCalculationMode,
  });
  const recurringWalking = detectRecurringWalking(recentLogs);

  return (
    <AppShell>
      <PageHeading title="Atividade física" description="Registre caminhada, treino ou cardio e acompanhe o gasto adicional do dia." />

      <Stack>
        <Hero aria-label={dayLabel(comparison.label)}>
          <div className="flex items-center gap-3">
            <IconTile icon={Calculator} colour="gray" />
            <div>
              <h2>{dayLabel(comparison.label)}</h2>
              <p className="text-sm text-text-muted">Gasto do dia com as atividades</p>
            </div>
          </div>
          <p className="mt-5 text-[40px] font-bold leading-[44px] tracking-[-0.03em] tabular-nums">{comparison.checkedTdee.toLocaleString("pt-BR")} <span className="text-body font-normal tracking-normal text-text-muted">kcal no dia ajustado</span></p>
          <div className="mt-5 grid overflow-hidden rounded-[14px] bg-surface-tertiary md:grid-cols-2">
            <Stat label="Gasto base" value={`${Math.round(tdee).toLocaleString("pt-BR")} kcal`} />
            <Stat label="Extra válido" value={`${tdeeResult.activityKcal.toLocaleString("pt-BR")} kcal`} />
          </div>
          <p className="mt-5 text-sm leading-6 text-text-muted">
            Modo atual: {profile.tdeeCalculationMode === "ADDITIVE" ? "aditivo" : "coeficiente"}. Registrado bruto: {tdeeResult.rawActivityKcal} kcal. Ignorado para evitar inflação: {tdeeResult.ignoredActivityKcal} kcal.
          </p>
        </Hero>

        <Section title="Hoje" columns="wide">
          <GlassCard>
            <div className="flex items-center gap-3">
              <IconTile icon={Plus} colour="yellow" />
              <div>
                <h3 className="font-semibold">Registrar atividade</h3>
                <p className="text-sm text-text-muted">Escolha o tipo, o tempo e como você sentiu o esforço.</p>
              </div>
            </div>

            <ActivityForm
              presets={activityPresets}
              efforts={activityEfforts}
              defaultDate={dateInputValue(today)}
              strengthWarning={strengthWarning}
            />
          </GlassCard>

          <GlassCard>
            <h3 className="font-semibold">Registradas hoje</h3>
            <div className="mt-2 grid">
              {logs.length ? logs.map((log) => (
                <ActivityRow key={log.id} log={log} />
              )) : <p className="mt-2 text-sm text-text-muted">Nenhuma atividade registrada hoje.</p>}
            </div>
          </GlassCard>
        </Section>

        <Section title="Histórico" columns={recurringWalking ? 2 : 1}>
          <GlassCard>
            <h3 className="font-semibold">Últimos registros</h3>
            <div className="mt-2 grid">
              {recentLogs.length ? recentLogs.map((log) => (
                <ActivityRow key={log.id} log={log} compact />
              )) : <p className="mt-2 text-sm text-text-muted">Sem histórico ainda.</p>}
            </div>
          </GlassCard>

          {recurringWalking ? (
            <GlassCard>
              <h3 className="font-semibold">Caminhada recorrente</h3>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Uma caminhada parecida aparece em {recurringWalking.count} registros, com média de {formatNumber(recurringWalking.averageDistanceKm)} km.
              </p>
            </GlassCard>
          ) : null}
        </Section>
      </Stack>
    </AppShell>
  );
}

function ActivityRow({
  log,
  compact = false,
}: {
  log: { id: string; name: string; date: Date; durationMinutes: number; distanceKm: number | null; averageSpeedKmh: number | null; caloriesKcal: number; conservativeCaloriesKcal: number | null; countsTowardTdee: boolean; intensity: string | null; note: string | null };
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline py-3 last:border-b-0">
      <div>
        <p className="font-semibold">{log.name}</p>
        <p className="mt-0.5 text-sm text-text-muted">
          {compact ? `${log.date.toLocaleDateString("pt-BR")} · ` : ""}{log.durationMinutes} min
          {log.distanceKm ? ` · ${formatNumber(log.distanceKm)} km` : ""}
          {log.averageSpeedKmh ? ` · ${formatNumber(log.averageSpeedKmh)} km/h` : ""}
          {log.intensity ? ` · intensidade ${log.intensity.toLowerCase()}` : ""}
          {log.note ? ` · ${log.note}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-right text-sm">
          <b className="font-semibold tabular-nums">{Math.round(log.conservativeCaloriesKcal ?? log.caloriesKcal)} kcal</b>
          <span className={`block text-xs ${log.countsTowardTdee ? "text-success" : "text-text-muted"}`}>{log.countsTowardTdee ? "válidas no gasto" : "só registradas"}</span>
        </span>
        <form action={deletePhysicalActivityAction}>
          <input type="hidden" name="activityId" value={log.id} />
          <button className="grid size-10 place-items-center rounded-full bg-fill text-text-secondary hover:bg-danger/15 hover:text-danger" aria-label="Excluir atividade">
            <Trash2 size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-4 py-3 shadow-[-1px_0_0_var(--hairline),0_-1px_0_var(--hairline)]">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-[22px] font-semibold leading-7 tabular-nums">{value}</p>
    </div>
  );
}

function dateInputValue(date: Date) {
  return appDateInputValue(date);
}

function dayLabel(label: string) {
  if (label === "dia mais ativo") return "Você gastou mais que o previsto";
  if (label === "dia menos ativo") return "Você se movimentou menos que o previsto";
  return "Seu dia está dentro do esperado";
}

function detectRecurringWalking(logs: Array<{ activityKey: string; distanceKm: number | null }>) {
  const walking = logs.filter((log) => ["walk_light", "walk_fast", "active_commute"].includes(log.activityKey) && typeof log.distanceKm === "number") as Array<{ distanceKm: number }>;
  if (walking.length < 3) return null;

  const averageDistanceKm = walking.reduce((total, log) => total + log.distanceKm, 0) / walking.length;
  const similar = walking.filter((log) => Math.abs(log.distanceKm - averageDistanceKm) <= averageDistanceKm * 0.15);

  return similar.length >= 3 ? { count: similar.length, averageDistanceKm } : null;
}
