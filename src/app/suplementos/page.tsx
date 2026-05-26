import { Archive, Check, FlaskConical, Plus, RotateCcw, ShieldAlert, Trash2, Zap } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/profile";
import {
  estimateSupplementProgress,
  recommendedSupplementDose,
  supplementDisplayName,
  supplementProtocolLabel,
  supplementSafetyNote,
  type SupplementProtocol,
  type SupplementType,
} from "@/lib/supplements";
import {
  addSupplementUsagePeriodAction,
  archiveSupplementPlanAction,
  createSupplementPlanAction,
  deleteSupplementLogAction,
  deleteSupplementUsagePeriodAction,
  logSupplementDoseAction,
  restoreSupplementPlanAction,
} from "./actions";

export default async function SuplementosPage() {
  const { user } = await requireUserProfile();
  const plans = await prisma.supplementPlan.findMany({
    where: { userId: user.id },
    include: {
      logs: { orderBy: { date: "desc" }, take: 35 },
      periods: { orderBy: { startDate: "desc" } },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
  const activePlans = plans.filter((plan) => plan.isActive);
  const today = dateInputValue(new Date());

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-lime-300">Suplementos</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Saturação e aderência</h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Acompanhe creatina e beta-alanina por dose acumulada, regularidade e fase estimada. Isso não substitui orientação profissional.
          </p>
        </div>
        <div className="rounded-3xl border border-lime-300/20 bg-lime-300/10 px-5 py-4 text-right">
          <p className="text-2xl font-semibold text-lime-200">{activePlans.length}</p>
          <p className="text-xs text-zinc-400">ativos</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-lime-300 text-black">
              <Plus size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Novo acompanhamento</h2>
              <p className="text-sm text-zinc-500">Escolha o suplemento e ajuste a dose real que você usa.</p>
            </div>
          </div>

          <form action={createSupplementPlanAction} className="mt-6 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <select name="type" className={inputClass} defaultValue="CREATINE">
                <option value="CREATINE">Creatina</option>
                <option value="BETA_ALANINE">Beta-alanina</option>
              </select>
              <select name="protocol" className={inputClass} defaultValue="STEADY">
                <option value="STEADY">Uso contínuo</option>
                <option value="LOADING">Com fase de carga</option>
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="dailyDoseG" inputMode="decimal" className={inputClass} placeholder="Dose diária em g. Ex: 5" />
              <input name="startedAt" type="date" defaultValue={today} className={inputClass} />
            </div>
            <textarea
              name="notes"
              className="min-h-24 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-lime-300/50"
              placeholder="Observação opcional. Ex: tomo junto do almoço"
            />
            <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lime-300 px-5 font-semibold text-black transition hover:bg-lime-200">
              <Plus size={18} />
              Começar acompanhamento
            </button>
          </form>
        </GlassCard>

        <GlassCard className="border-amber-300/20 bg-amber-300/[0.04]">
          <div className="flex items-start gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-amber-300/15 text-amber-200">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Como o ShapeOS calcula</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                É uma estimativa por dose acumulada e dias de uso. Creatina usa como referência a fase de carga clássica ou acúmulo contínuo.
                Beta-alanina acompanha adaptação por uso diário ao longo de semanas, não um efeito imediato.
              </p>
              <div className="mt-4 grid gap-2 text-sm text-zinc-400 md:grid-cols-2">
                <Info label="Creatina padrão" value={`${recommendedSupplementDose("CREATINE", "STEADY")} g/dia`} />
                <Info label="Creatina carga" value={`${recommendedSupplementDose("CREATINE", "LOADING")} g/dia`} />
                <Info label="Beta-alanina" value={`${recommendedSupplementDose("BETA_ALANINE", "STEADY")} g/dia`} />
                <Info label="Precisão" value="estimativa, não exame" />
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => {
          const progress = estimateSupplementProgress({
            type: plan.type as SupplementType,
            protocol: plan.protocol as SupplementProtocol,
            dailyDoseG: plan.dailyDoseG,
            startedAt: plan.startedAt,
            logs: plan.logs,
            periods: plan.periods,
          });
          const todayLog = plan.logs.find((log) => sameDay(log.date, new Date()));

          return (
            <GlassCard key={plan.id} className={plan.isActive ? "border-lime-300/25" : "opacity-65"}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-2xl bg-lime-300/15 text-lime-300">
                    {plan.type === "CREATINE" ? <Zap size={22} /> : <FlaskConical size={22} />}
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">{supplementProtocolLabel(plan.protocol as SupplementProtocol)}</p>
                    <h2 className="text-2xl font-semibold">{supplementDisplayName(plan.type as SupplementType)}</h2>
                  </div>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-zinc-300">{progress.status}</span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[180px_1fr] md:items-center">
                <div className="relative grid size-40 place-items-center rounded-full bg-black/30">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ background: `conic-gradient(#b8ff00 ${progress.percent * 3.6}deg, rgba(255,255,255,.09) 0deg)` }}
                  />
                  <div className="relative grid size-28 place-items-center rounded-full bg-[#0b0b0b]">
                    <div className="text-center">
                      <p className="text-3xl font-semibold">{progress.percent}%</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">estimado</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <MiniStat label="Dose/dia" value={`${formatNumber(plan.dailyDoseG)}g`} />
                    <MiniStat label="Acumulado" value={`${formatNumber(progress.totalDoseG)}g`} />
                    <MiniStat label="Aderência" value={`${progress.adherencePct}%`} />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-zinc-400">{progress.guidance}</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">{supplementSafetyNote(plan.type as SupplementType)}</p>
                </div>
              </div>

              {plan.isActive ? (
                <div className="mt-6 grid gap-3">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <form action={logSupplementDoseAction} className="grid gap-2 rounded-3xl bg-black/25 p-3 sm:grid-cols-[1fr_120px_auto]">
                      <input type="hidden" name="planId" value={plan.id} />
                      <input name="date" type="date" defaultValue={today} className="h-11 rounded-2xl bg-white/10 px-3 text-sm outline-none" />
                      <input name="doseG" inputMode="decimal" defaultValue={todayLog?.doseG ?? plan.dailyDoseG} className="h-11 rounded-2xl bg-white/10 px-3 text-sm outline-none" />
                      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-lime-300 px-4 text-sm font-semibold text-black">
                        <Check size={15} />
                        Registrar hoje
                      </button>
                    </form>
                    <form action={archiveSupplementPlanAction}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <button className="inline-flex h-full min-h-11 items-center justify-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold text-zinc-200 transition hover:bg-white/15">
                        <Archive size={15} />
                        Arquivar
                      </button>
                    </form>
                  </div>

                  <form action={addSupplementUsagePeriodAction} className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-4">
                    <input type="hidden" name="planId" value={plan.id} />
                    <p className="text-sm font-semibold text-zinc-200">Importar periodo anterior</p>
                    <p className="mt-1 text-xs text-zinc-500">Informe gramatura e intervalo para calcular o uso passado sem cadastrar dia por dia.</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_120px_120px]">
                      <input name="startDate" type="date" className="h-11 rounded-2xl bg-white/10 px-3 text-sm outline-none" required />
                      <input name="endDate" type="date" className="h-11 rounded-2xl bg-white/10 px-3 text-sm outline-none" />
                      <input name="dailyDoseG" inputMode="decimal" defaultValue={plan.dailyDoseG} className="h-11 rounded-2xl bg-white/10 px-3 text-sm outline-none" placeholder="g/dia" required />
                      <input name="adherencePct" inputMode="decimal" defaultValue="100" className="h-11 rounded-2xl bg-white/10 px-3 text-sm outline-none" placeholder="% uso" />
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
                      <input name="note" className="h-11 rounded-2xl bg-white/10 px-3 text-sm outline-none" placeholder="Ex: usava quase todo dia" />
                      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold text-zinc-100 transition hover:bg-white/15">
                        Importar periodo
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <form action={restoreSupplementPlanAction} className="mt-6">
                  <input type="hidden" name="planId" value={plan.id} />
                  <button className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-lime-300 px-4 text-sm font-semibold text-black transition hover:bg-lime-200">
                    <RotateCcw size={15} />
                    Reativar suplemento
                  </button>
                </form>
              )}

              {plan.periods.length ? (
                <div className="mt-5 rounded-3xl bg-black/20 p-4">
                  <p className="text-sm font-semibold text-zinc-300">Periodos importados</p>
                  <div className="mt-3 grid gap-2">
                    {plan.periods.map((period) => (
                      <div key={period.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/[0.04] px-3 py-2 text-xs text-zinc-400">
                        <span>{period.startDate.toLocaleDateString("pt-BR")} ate {period.endDate?.toLocaleDateString("pt-BR") ?? "hoje"}</span>
                        <div className="flex items-center gap-2">
                          <span>{formatNumber(period.dailyDoseG)}g/dia - {formatNumber(period.adherencePct)}%</span>
                          <form action={deleteSupplementUsagePeriodAction}>
                            <input type="hidden" name="periodId" value={period.id} />
                            <button className="grid size-7 place-items-center rounded-full bg-white/10 text-zinc-400 transition hover:bg-red-500/20 hover:text-red-200" aria-label="Apagar periodo importado">
                              <Trash2 size={13} />
                            </button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {plan.logs.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {plan.logs.slice(0, 10).map((log) => (
                    <span key={log.id} className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-zinc-400">
                      {log.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}: {formatNumber(log.doseG)}g
                      <form action={deleteSupplementLogAction}>
                        <input type="hidden" name="logId" value={log.id} />
                        <button className="grid size-6 place-items-center rounded-full bg-white/10 transition hover:bg-red-500/20 hover:text-red-200" aria-label="Apagar registro diario">
                          <Trash2 size={12} />
                        </button>
                      </form>
                    </span>
                  ))}
                </div>
              ) : null}
            </GlassCard>
          );
        })}

        {!plans.length ? (
          <GlassCard>
            <p className="text-zinc-300">Você ainda não acompanha nenhum suplemento.</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">Crie um acompanhamento para registrar dose e ver a fase estimada.</p>
          </GlassCard>
        ) : null}
      </div>
    </AppShell>
  );
}

const inputClass = "h-12 rounded-2xl border border-white/10 bg-black/30 px-4 outline-none transition focus:border-lime-300/50";

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/25 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/25 px-3 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sameDay(a: Date, b: Date) {
  return dateInputValue(a) === dateInputValue(b);
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
