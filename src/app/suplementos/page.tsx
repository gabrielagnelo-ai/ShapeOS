import { PageHeading } from "@/components/ui/page-heading";
import { Hero, Section, Stack } from "@/components/ui/screen";
import { Archive, Check, FlaskConical, Pill, Plus, RotateCcw, ShieldAlert, Trash2, Zap } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { appDateInputValue } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/profile";
import {
  estimateSupplementProgress,
  parseSupplementMicronutrients,
  recommendedSupplementDose,
  supplementDoseUnit,
  supplementDisplayName,
  supplementNutrientDefinitions,
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
  deleteSupplementPlanAction,
  deleteSupplementUsagePeriodAction,
  logSupplementDoseAction,
  restoreSupplementPlanAction,
  updateMultivitaminLabelAction,
} from "./actions";
import { formatNumber } from "@/lib/common";

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
  const loggedToday = activePlans.filter((plan) => plan.logs.some((log) => sameDay(log.date, new Date()))).length;
  const today = dateInputValue(new Date());

  return (
    <AppShell>
      <PageHeading title="Suplementos" description="Registre as doses e acompanhe o uso de cada suplemento." />

      <Stack>
        <Hero aria-label="Doses de hoje">
          <p className="text-headline">Doses de hoje</p>
          {activePlans.length ? (
            <>
              <p className="mt-2 text-[40px] font-bold leading-[44px] tracking-[-0.03em] tabular-nums">{loggedToday} <span className="text-body font-normal tracking-normal text-text-muted">de {activePlans.length} {activePlans.length === 1 ? "registrada" : "registradas"}</span></p>
              <p className="mt-2 text-sm text-text-muted">{loggedToday === activePlans.length ? "Todas as doses de hoje estão registradas." : "Registre a dose no cartão de cada suplemento."}</p>
            </>
          ) : <p className="mt-2 text-sm text-text-muted">Nenhum acompanhamento ativo. Comece um em “Novo acompanhamento”.</p>}
        </Hero>
        <Section title="Seus suplementos" columns={2}>
        {plans.map((plan) => {
          const type = plan.type as SupplementType;
          const isMultivitamin = type === "MULTIVITAMIN";
          const labelNutrients = parseSupplementMicronutrients(plan.micronutrientsPerDose);
          const progress = estimateSupplementProgress({
            type,
            protocol: plan.protocol as SupplementProtocol,
            dailyDoseG: plan.dailyDoseG,
            startedAt: plan.startedAt,
            logs: plan.logs,
            periods: plan.periods,
          });
          const todayLog = plan.logs.find((log) => sameDay(log.date, new Date()));

          return (
            <GlassCard key={plan.id} className={plan.isActive ? "" : "opacity-65"}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="icon-tile [--tile:#32ade6]">
                    {type === "CREATINE" ? <Zap size={22} /> : isMultivitamin ? <Pill size={22} /> : <FlaskConical size={22} />}
                  </div>
                  <div>
                    <p className="text-sm text-text-muted">{supplementProtocolLabel(plan.protocol as SupplementProtocol)}</p>
                    <h2 className="text-2xl font-semibold">{plan.name || supplementDisplayName(type)}</h2>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-text-secondary">{progress.status}</span>
                  <form action={deleteSupplementPlanAction}>
                    <input type="hidden" name="planId" value={plan.id} />
                    <button className="grid size-9 place-items-center rounded-full bg-fill text-text-primary transition hover:bg-fill-strong" aria-label="Excluir suplemento">
                      <Trash2 size={15} />
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[180px_1fr] md:items-center">
                <div className="relative grid size-40 place-items-center rounded-full bg-surface-tertiary">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ background: `conic-gradient(#b8ff00 ${progress.percent * 3.6}deg, rgba(255,255,255,.09) 0deg)` }}
                  />
                  <div className="relative grid size-28 place-items-center rounded-full bg-[#0b0b0b]">
                    <div className="text-center">
                      <p className="text-3xl font-semibold">{progress.percent}%</p>
                      <p className="text-xs text-text-muted">{isMultivitamin ? "28 doses" : "estimado"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <MiniStat label="Dose/dia" value={`${formatNumber(plan.dailyDoseG)} ${supplementDoseUnit(type, plan.dailyDoseG)}`} />
                    <MiniStat label="Registrado" value={`${formatNumber(progress.totalDoseG)} ${supplementDoseUnit(type, progress.totalDoseG)}`} />
                    <MiniStat label="Aderência" value={`${progress.adherencePct}%`} />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-text-muted">{progress.guidance}</p>
                  <p className="mt-2 text-xs leading-5 text-text-muted">{supplementSafetyNote(type)}</p>
                </div>
              </div>

              {isMultivitamin ? (
                <details className="mt-5 border-t border-hairline pt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-text-secondary">Editar produto e rótulo</summary>
                  <form action={updateMultivitaminLabelAction} className="mt-4 grid gap-3">
                    <input type="hidden" name="planId" value={plan.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input name="name" defaultValue={plan.name} className={inputClass} required />
                      <input name="dailyDoseG" inputMode="decimal" defaultValue={plan.dailyDoseG} className={inputClass} aria-label="Doses por dia" required />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {supplementNutrientDefinitions.map((nutrient) => (
                        <NutrientInput
                          key={nutrient.key}
                          name={nutrient.key}
                          label={`${nutrient.label} (${nutrient.unit})`}
                          defaultValue={labelNutrients[nutrient.key]}
                        />
                      ))}
                    </div>
                    <button className="h-11 rounded-full bg-fill px-4 text-sm font-semibold text-text-primary transition hover:bg-fill-strong">
                      Salvar rótulo
                    </button>
                  </form>
                </details>
              ) : null}

              {plan.isActive ? (
                <div className="mt-6 grid gap-3">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <form action={logSupplementDoseAction} className="grid gap-2 rounded-[14px] bg-surface-tertiary p-3 sm:grid-cols-[1fr_120px_auto]">
                      <input type="hidden" name="planId" value={plan.id} />
                      <input name="date" type="date" defaultValue={today} className="h-11 rounded-2xl bg-white/10 px-3 text-sm outline-none" />
                      <input name="doseG" inputMode="decimal" defaultValue={todayLog?.doseG ?? plan.dailyDoseG} className="h-11 rounded-2xl bg-white/10 px-3 text-sm outline-none" />
                      <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary/15 text-primary hover:bg-primary/20 px-4 text-sm font-semibold">
                        <Check size={15} />
                        Registrar hoje
                      </button>
                    </form>
                    <form action={archiveSupplementPlanAction}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <button className="inline-flex h-full min-h-11 items-center justify-center gap-2 rounded-full bg-fill px-4 text-sm font-semibold text-text-primary transition hover:bg-fill-strong">
                        <Archive size={15} />
                        Arquivar
                      </button>
                    </form>
                  </div>

                  {!isMultivitamin ? <form action={addSupplementUsagePeriodAction} className="rounded-[14px] bg-surface-tertiary p-4">
                    <input type="hidden" name="planId" value={plan.id} />
                    <p className="text-sm font-semibold text-text-secondary">Importar período anterior</p>
                    <p className="mt-1 text-xs text-text-muted">Informe gramatura e intervalo para calcular o uso passado sem cadastrar dia por dia.</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_120px_120px]">
                      <input name="startDate" type="date" className="h-11 rounded-2xl bg-white/10 px-3 text-sm outline-none" required />
                      <input name="endDate" type="date" className="h-11 rounded-2xl bg-white/10 px-3 text-sm outline-none" />
                      <input name="dailyDoseG" inputMode="decimal" defaultValue={plan.dailyDoseG} className="h-11 rounded-2xl bg-white/10 px-3 text-sm outline-none" placeholder="g/dia" required />
                      <input name="adherencePct" inputMode="decimal" defaultValue="100" className="h-11 rounded-2xl bg-white/10 px-3 text-sm outline-none" placeholder="% uso" />
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
                      <input name="note" className="h-11 rounded-2xl bg-white/10 px-3 text-sm outline-none" placeholder="Ex: usava quase todo dia" />
                      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-fill px-4 text-sm font-semibold text-text-primary transition hover:bg-fill-strong">
                        Importar período
                      </button>
                    </div>
                  </form> : null}
                </div>
              ) : (
                <form action={restoreSupplementPlanAction} className="mt-6">
                  <input type="hidden" name="planId" value={plan.id} />
                  <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-fill text-text-primary hover:bg-fill-strong px-4 text-sm font-semibold">
                    <RotateCcw size={15} />
                    Reativar suplemento
                  </button>
                </form>
              )}

              {plan.periods.length ? (
                <div className="mt-5 border-t border-hairline pt-4">
                  <p className="text-sm font-semibold text-text-secondary">Períodos importados</p>
                  <div className="mt-3 grid gap-2">
                    {plan.periods.map((period) => (
                      <div key={period.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-surface-tertiary px-3 py-2 text-xs text-text-muted">
                        <span>{period.startDate.toLocaleDateString("pt-BR")} até {period.endDate?.toLocaleDateString("pt-BR") ?? "hoje"}</span>
                        <div className="flex items-center gap-2">
                          <span>{formatNumber(period.dailyDoseG)} {supplementDoseUnit(type, period.dailyDoseG)}/dia - {formatNumber(period.adherencePct)}%</span>
                          <form action={deleteSupplementUsagePeriodAction}>
                            <input type="hidden" name="periodId" value={period.id} />
                            <button className="grid size-7 place-items-center rounded-full bg-fill text-text-primary transition hover:bg-fill-strong" aria-label="Apagar período importado">
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
                    <span key={log.id} className="inline-flex items-center gap-2 rounded-full bg-fill px-3 py-1.5 text-xs text-text-secondary">
                      {log.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}: {formatNumber(log.doseG)} {supplementDoseUnit(type, log.doseG)}
                      <form action={deleteSupplementLogAction}>
                        <input type="hidden" name="logId" value={log.id} />
                        <button className="grid size-6 place-items-center rounded-full bg-fill text-text-primary transition hover:bg-fill-strong" aria-label="Apagar registro diário">
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
            <p className="text-text-secondary">Você ainda não acompanha nenhum suplemento.</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">Crie um acompanhamento para registrar dose e ver a fase estimada.</p>
          </GlassCard>
        ) : null}
        </Section>
        <Section title="Novo acompanhamento" columns={2}>
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="icon-tile [--tile:#32ade6]">
              <Plus size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Novo acompanhamento</h2>
              <p className="text-sm text-text-muted">Escolha o suplemento e ajuste a dose real que você usa.</p>
            </div>
          </div>

          <form action={createSupplementPlanAction} className="mt-6 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <select name="type" className={inputClass} defaultValue="CREATINE">
                <option value="CREATINE">Creatina</option>
                <option value="BETA_ALANINE">Beta-alanina</option>
                <option value="MULTIVITAMIN">Multivitamínico</option>
              </select>
              <select name="protocol" className={inputClass} defaultValue="STEADY">
                <option value="STEADY">Uso contínuo</option>
                <option value="LOADING">Com fase de carga</option>
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="name" className={inputClass} placeholder="Nome ou marca. Ex: Multi A-Z" />
              <input name="dailyDoseG" inputMode="decimal" className={inputClass} placeholder="Dose diária: 5 g ou 1 dose" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="startedAt" type="date" defaultValue={today} className={inputClass} />
              <div className="flex min-h-12 items-center rounded-2xl border border-hairline bg-surface-tertiary px-4 text-sm text-text-muted">
                Para multivitamínico, 1 significa uma porção do rótulo.
              </div>
            </div>
            <details className="rounded-2xl border border-hairline bg-surface-tertiary p-4">
              <summary className="cursor-pointer font-medium text-text-secondary">Valores do rótulo por dose</summary>
              <p className="mt-2 text-xs leading-5 text-text-muted">
                Preencha apenas ao escolher multivitamínico. Copie os valores da porção indicada na embalagem.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {supplementNutrientDefinitions.map((nutrient) => (
                  <NutrientInput key={nutrient.key} name={nutrient.key} label={`${nutrient.label} (${nutrient.unit})`} />
                ))}
              </div>
            </details>
            <textarea
              name="notes"
              className="min-h-24 rounded-[14px] bg-fill px-4 py-3 outline-none"
              placeholder="Observação opcional. Ex: tomo junto do almoço"
            />
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground hover:bg-primary-light px-5 font-semibold">
              <Plus size={18} />
              Começar acompanhamento
            </button>
          </form>
        </GlassCard>

        <GlassCard>
          <div className="flex items-start gap-3">
            <div className="icon-tile [--tile:#ffb800]">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Como o ShapeOS calcula</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Creatina e beta-alanina usam dose acumulada para estimar fase e regularidade. No multivitamínico, o percentual representa doses registradas,
                e os valores do rótulo são somados aos micronutrientes do Diário.
              </p>
              <div className="mt-4 grid gap-2 text-sm text-text-muted md:grid-cols-2">
                <Info label="Creatina padrão" value={`${recommendedSupplementDose("CREATINE", "STEADY")} g/dia`} />
                <Info label="Creatina carga" value={`${recommendedSupplementDose("CREATINE", "LOADING")} g/dia`} />
                <Info label="Beta-alanina" value={`${recommendedSupplementDose("BETA_ALANINE", "STEADY")} g/dia`} />
                <Info label="Multivitamínico" value="1 dose do rótulo/dia" />
              </div>
            </div>
          </div>
        </GlassCard>
        </Section>
      </Stack>
    </AppShell>
  );
}

const inputClass = "h-12 rounded-[14px] bg-fill px-4 outline-none";

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-tertiary px-4 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-tertiary px-3 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function NutrientInput({ name, label, defaultValue }: { name: string; label: string; defaultValue?: number }) {
  return (
    <label className="grid gap-1.5 text-xs text-text-muted">
      {label}
      <input name={name} inputMode="decimal" defaultValue={defaultValue || undefined} className="h-11 rounded-[14px] bg-fill px-3 text-sm text-text-primary outline-none" placeholder="0" />
    </label>
  );
}

function dateInputValue(date: Date) {
  return appDateInputValue(date);
}

function sameDay(a: Date, b: Date) {
  return dateInputValue(a) === dateInputValue(b);
}
