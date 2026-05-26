import { Activity, Calculator, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { activityPresets, tdeeCheck } from "@/lib/activity";
import { calculateBmr, calculateTdee, type Sex } from "@/lib/nutrition";
import { prisma } from "@/lib/prisma";
import { endOfToday, requireUserProfile, startOfToday } from "@/lib/profile";
import { addPhysicalActivityAction, deletePhysicalActivityAction } from "./actions";

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
  const tdee = calculateTdee(bmr, profile.activityFactor);
  const loggedKcal = logs.reduce((total, log) => total + log.caloriesKcal, 0);
  const comparison = tdeeCheck({ estimatedTdee: tdee, loggedActivityKcal: loggedKcal });

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-lime-300">Atividade física</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Gasto estimado do dia</h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Registre treino, caminhada ou cardio manualmente. O ShapeOS estima calorias por MET e compara com seu TDEE.
          </p>
        </div>
        <div className="rounded-3xl border border-lime-300/20 bg-lime-300/10 px-5 py-4 text-right">
          <p className="text-2xl font-semibold text-lime-200">{Math.round(loggedKcal)}</p>
          <p className="text-xs text-zinc-400">kcal registradas hoje</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-lime-300 text-black">
              <Plus size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Registrar atividade</h2>
              <p className="text-sm text-zinc-500">Use o MET padrão ou ajuste manualmente se souber.</p>
            </div>
          </div>

          <form action={addPhysicalActivityAction} className="mt-6 grid gap-3">
            <select name="activityKey" className={inputClass} defaultValue="weight_training">
              {activityPresets.map((preset) => (
                <option key={preset.key} value={preset.key}>{preset.name} - MET {preset.met}</option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-3">
              <input name="date" type="date" defaultValue={dateInputValue(today)} className={inputClass} />
              <input name="durationMinutes" inputMode="numeric" className={inputClass} placeholder="minutos" required />
              <input name="met" inputMode="decimal" className={inputClass} placeholder="MET opcional" />
            </div>
            <input name="customName" className={inputClass} placeholder="Nome personalizado opcional" />
            <input name="note" className={inputClass} placeholder="Observação opcional. Ex: treino de pernas" />
            <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lime-300 px-5 font-semibold text-black transition hover:bg-lime-200">
              <Activity size={18} />
              Registrar gasto
            </button>
          </form>
        </GlassCard>

        <GlassCard className="border-lime-300/20 bg-lime-300/[0.04]">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-lime-300/15 text-lime-300">
              <Calculator size={22} />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Conferência do TDEE</p>
              <h2 className="text-xl font-semibold">{comparison.label}</h2>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <Stat label="TDEE estimado" value={`${Math.round(tdee)} kcal`} />
            <Stat label="Atividade registrada" value={`${Math.round(loggedKcal)} kcal`} />
            <Stat label="TDEE conferido" value={`${comparison.checkedTdee} kcal`} />
          </div>
          <p className="mt-5 text-sm leading-6 text-zinc-400">
            Estimativa baseada em MET: calorias = MET x peso x horas. Serve para tendência; relógio, frequência cardíaca e potência tendem a refinar esse número.
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
          <h2 className="text-xl font-semibold">Histórico recente</h2>
          <div className="mt-4 grid gap-3">
            {recentLogs.length ? recentLogs.map((log) => (
              <ActivityRow key={log.id} log={log} compact />
            )) : <p className="text-sm text-zinc-500">Sem histórico ainda.</p>}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}

const inputClass = "h-12 rounded-2xl border border-white/10 bg-black/30 px-4 outline-none transition focus:border-lime-300/50";

function ActivityRow({
  log,
  compact = false,
}: {
  log: { id: string; name: string; date: Date; durationMinutes: number; met: number; caloriesKcal: number; note: string | null };
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-black/25 px-4 py-3">
      <div>
        <p className="font-semibold">{log.name}</p>
        <p className="mt-1 text-sm text-zinc-500">
          {compact ? `${log.date.toLocaleDateString("pt-BR")} - ` : ""}{log.durationMinutes} min - MET {log.met}
          {log.note ? ` - ${log.note}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-lime-300/15 px-3 py-1 text-sm font-semibold text-lime-200">{Math.round(log.caloriesKcal)} kcal</span>
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
