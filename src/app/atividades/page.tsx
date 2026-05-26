import { Calculator, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { activityEfforts, activityPresets, tdeeCheck } from "@/lib/activity";
import { calculateBmr, calculateTdee, type Sex } from "@/lib/nutrition";
import { prisma } from "@/lib/prisma";
import { endOfToday, requireUserProfile, startOfToday } from "@/lib/profile";
import { effectiveTdee, tdeeInflationWarning } from "@/lib/tdee";
import { deletePhysicalActivityAction } from "./actions";
import { ActivityForm } from "./activity-form";

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
  const bmr = calculateBmr({ sex: sexMap[profile.sex] as Sex, age: profile.age, heightCm: profile.heightCm, weightKg: profile.weightKg });
  const tdee = calculateTdee(bmr, profile.activityFactor) + profile.tdeeAdjustmentKcal;
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-lime-300">Atividade fisica</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Quanto voce se movimentou hoje?</h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Registre treino, caminhada ou cardio em linguagem simples. O ShapeOS evita somar duas vezes o que ja esta embutido no seu fator de atividade.
          </p>
        </div>
        <div className="rounded-3xl border border-lime-300/20 bg-lime-300/10 px-5 py-4 text-right">
          <p className="text-2xl font-semibold text-lime-200">{tdeeResult.activityKcal}</p>
          <p className="text-xs text-zinc-400">kcal extras validas hoje</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-lime-300 text-black">
              <Plus size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Registrar sem complicar</h2>
              <p className="text-sm text-zinc-500">Escolha o tipo, o tempo e como voce sentiu o esforco.</p>
            </div>
          </div>

          <ActivityForm
            presets={activityPresets}
            efforts={activityEfforts}
            defaultDate={dateInputValue(today)}
            strengthWarning={strengthWarning}
          />
        </GlassCard>

        <GlassCard className="border-lime-300/20 bg-lime-300/[0.04]">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-lime-300/15 text-lime-300">
              <Calculator size={22} />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Leitura do dia</p>
              <h2 className="text-xl font-semibold">{dayLabel(comparison.label)}</h2>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <Stat label="Gasto base" value={`${Math.round(tdee)} kcal`} />
            <Stat label="Extra valido" value={`${tdeeResult.activityKcal} kcal`} />
            <Stat label="Dia ajustado" value={`${comparison.checkedTdee} kcal`} />
          </div>
          <p className="mt-5 text-sm leading-6 text-zinc-400">
            Modo atual: {profile.tdeeCalculationMode === "ADDITIVE" ? "aditivo" : "coeficiente"}. Registrado bruto: {tdeeResult.rawActivityKcal} kcal. Ignorado para evitar inflacao: {tdeeResult.ignoredActivityKcal} kcal.
          </p>
        </GlassCard>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <h2 className="text-xl font-semibold">Hoje</h2>
          <div className="mt-4 grid gap-3">
            {logs.length ? logs.map((log) => (
              <ActivityRow key={log.id} log={log} />
            )) : <p className="text-sm text-zinc-500">Nenhuma atividade registrada hoje.</p>}
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-xl font-semibold">Historico recente</h2>
          <div className="mt-4 grid gap-3">
            {recentLogs.length ? recentLogs.map((log) => (
              <ActivityRow key={log.id} log={log} compact />
            )) : <p className="text-sm text-zinc-500">Sem historico ainda.</p>}
          </div>
        </GlassCard>
      </div>

      {recurringWalking ? (
        <GlassCard className="mt-5 border-lime-300/25 bg-lime-300/[0.06]">
          <h2 className="text-xl font-semibold">Caminhada recorrente detectada</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Detectamos uma caminhada parecida em {recurringWalking.count} registros, com media de {formatNumber(recurringWalking.averageDistanceKm)} km. Futuramente voce podera salvar como atividade padrao.
          </p>
        </GlassCard>
      ) : null}
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-black/25 px-4 py-3">
      <div>
        <p className="font-semibold">{log.name}</p>
        <p className="mt-1 text-sm text-zinc-500">
          {compact ? `${log.date.toLocaleDateString("pt-BR")} - ` : ""}{log.durationMinutes} min
          {log.distanceKm ? ` - ${formatNumber(log.distanceKm)} km` : ""}
          {log.averageSpeedKmh ? ` - ${formatNumber(log.averageSpeedKmh)} km/h` : ""}
          {log.intensity ? ` - intensidade ${log.intensity.toLowerCase()}` : ""}
          {log.note ? ` - ${log.note}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${log.countsTowardTdee ? "bg-lime-300/15 text-lime-200" : "bg-white/10 text-zinc-400"}`}>
          {Math.round(log.conservativeCaloriesKcal ?? log.caloriesKcal)} kcal {log.countsTowardTdee ? "validas" : "registradas"}
        </span>
        <form action={deletePhysicalActivityAction}>
          <input type="hidden" name="activityId" value={log.id} />
          <button className="grid size-9 place-items-center rounded-full bg-white/10 text-zinc-400 transition hover:bg-red-500/20 hover:text-red-200" aria-label="Excluir atividade">
            <Trash2 size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-black/25 px-4 py-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dayLabel(label: string) {
  if (label === "dia mais ativo") return "Voce gastou mais que o previsto";
  if (label === "dia menos ativo") return "Voce se movimentou menos que o previsto";
  return "Seu dia esta dentro do esperado";
}

function detectRecurringWalking(logs: Array<{ activityKey: string; distanceKm: number | null }>) {
  const walking = logs.filter((log) => ["walk_light", "walk_fast", "active_commute"].includes(log.activityKey) && typeof log.distanceKm === "number") as Array<{ distanceKm: number }>;
  if (walking.length < 3) return null;

  const averageDistanceKm = walking.reduce((total, log) => total + log.distanceKm, 0) / walking.length;
  const similar = walking.filter((log) => Math.abs(log.distanceKm - averageDistanceKm) <= averageDistanceKm * 0.15);

  return similar.length >= 3 ? { count: similar.length, averageDistanceKm } : null;
}

function formatNumber(value: number) {
  return (Math.round(value * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
