import { Activity, Calculator, Clock3, Info, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { activityEfforts, activityPresets, tdeeCheck } from "@/lib/activity";
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
          <p className="text-sm font-medium text-lime-300">Atividade fisica</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Quanto voce se movimentou hoje?</h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Registre treino, caminhada ou cardio em linguagem simples. O ShapeOS estima o gasto e ajuda a conferir se seu dia ficou mais ativo ou mais parado que o esperado.
          </p>
        </div>
        <div className="rounded-3xl border border-lime-300/20 bg-lime-300/10 px-5 py-4 text-right">
          <p className="text-2xl font-semibold text-lime-200">{Math.round(loggedKcal)}</p>
          <p className="text-xs text-zinc-400">kcal de atividade hoje</p>
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

          <form action={addPhysicalActivityAction} className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-zinc-400">O que voce fez?</span>
              <select name="activityKey" className={inputClass} defaultValue="weight_training">
                {activityPresets.map((preset) => (
                  <option key={preset.key} value={preset.key}>{preset.name}</option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-zinc-400">Quando?</span>
                <input name="date" type="date" defaultValue={dateInputValue(today)} className={inputClass} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-zinc-400">Durou quanto tempo?</span>
                <div className="relative">
                  <Clock3 className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input name="durationMinutes" inputMode="numeric" className={`${inputClass} pl-11`} placeholder="Ex: 45 minutos" required />
                </div>
              </label>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium text-zinc-400">Como foi o esforco?</span>
              <div className="grid gap-2 md:grid-cols-3">
                {activityEfforts.map((effort) => (
                  <label key={effort.key} className="cursor-pointer rounded-[24px] border border-white/10 bg-black/25 p-4 transition hover:border-lime-300/40 has-[:checked]:border-lime-300/60 has-[:checked]:bg-lime-300/10">
                    <input type="radio" name="effort" value={effort.key} defaultChecked={effort.key === "moderate"} className="sr-only" />
                    <span className="block font-semibold text-zinc-100">{effort.label}</span>
                    <span className="mt-1 block text-sm leading-5 text-zinc-500">{effort.helper}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-zinc-400">Se escolheu Outra atividade, escreva o nome</span>
              <input name="customName" className={inputClass} placeholder="Ex: jiu-jitsu, beach tennis, obra em casa" />
            </label>

            <input name="note" className={inputClass} placeholder="Observacao opcional. Ex: treino de pernas" />

            <details className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-zinc-300">
                <Info size={16} />
                Ajuste avancado
              </summary>
              <p className="mt-3 text-sm leading-6 text-zinc-500">
                Use apenas se voce ja souber o equivalente metabolico da atividade. Se deixar vazio, o ShapeOS calcula automaticamente pela atividade e intensidade.
              </p>
              <input name="met" inputMode="decimal" className={`${inputClass} mt-3`} placeholder="Valor tecnico opcional" />
            </details>

            <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lime-300 px-5 font-semibold text-black transition hover:bg-lime-200">
              <Activity size={18} />
              Registrar atividade
            </button>
          </form>
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
            <Stat label="Seu gasto base estimado" value={`${Math.round(tdee)} kcal`} />
            <Stat label="Atividade registrada" value={`${Math.round(loggedKcal)} kcal`} />
            <Stat label="Dia ajustado" value={`${comparison.checkedTdee} kcal`} />
          </div>
          <p className="mt-5 text-sm leading-6 text-zinc-400">
            Isso e uma estimativa para orientar tendencia. Quando houver Apple Watch, o app podera trocar esse calculo manual por dados de batimento, passos e treino.
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
    </AppShell>
  );
}

const inputClass = "h-12 rounded-2xl border border-white/10 bg-black/30 px-4 outline-none transition focus:border-lime-300/50";

function ActivityRow({
  log,
  compact = false,
}: {
  log: { id: string; name: string; date: Date; durationMinutes: number; caloriesKcal: number; intensity: string | null; note: string | null };
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-black/25 px-4 py-3">
      <div>
        <p className="font-semibold">{log.name}</p>
        <p className="mt-1 text-sm text-zinc-500">
          {compact ? `${log.date.toLocaleDateString("pt-BR")} - ` : ""}{log.durationMinutes} min
          {log.intensity ? ` - intensidade ${log.intensity.toLowerCase()}` : ""}
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

function dayLabel(label: string) {
  if (label === "dia mais ativo") return "Voce gastou mais que o previsto";
  if (label === "dia menos ativo") return "Voce se movimentou menos que o previsto";
  return "Seu dia esta dentro do esperado";
}
