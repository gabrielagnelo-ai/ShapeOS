import { PageHeading } from "@/components/ui/page-heading";
import { Hero, Section, Stack } from "@/components/ui/screen";
import { Activity, Check, Dumbbell, FileUp, ShieldAlert, Trash2, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { IconTile } from "@/components/ui/group";
import { appDateInputValue } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/profile";
import { analyzeTrainingPerformance, trainingLogsFromPlans, trainingPerformanceTone } from "@/lib/training-performance";
import { createManualTrainingPlanAction, deleteTrainingExerciseLogAction, deleteTrainingPlanAction, importTrainingPdfAction, logTrainingExerciseAction, setActiveTrainingPlanAction } from "./actions";
import { confidenceLabel, formatNumber } from "@/lib/common";

export default async function TrainingPage({ searchParams }: { searchParams: Promise<{ importStatus?: string }> }) {
  const { importStatus } = await searchParams;
  const { user } = await requireUserProfile();
  const plans = await prisma.trainingPlan.findMany({
    where: { userId: user.id },
    include: {
      days: {
        orderBy: { order: "asc" },
        include: { exercises: { orderBy: { order: "asc" }, include: { logs: { where: { userId: user.id }, orderBy: { date: "desc" }, take: 3 } } } },
      },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    take: 8,
  });
  const activePlan = plans.find((plan) => plan.isActive);
  const performance = analyzeTrainingPerformance(trainingLogsFromPlans(plans));
  const performanceTone = trainingPerformanceTone(performance);

  return (
    <AppShell>
      <PageHeading title="Treinos" description="Organize os exercícios e registre carga, repetições e esforço." />

      {importStatus === "unreadable" ? <p role="status" className="mt-5 rounded-[14px] bg-warning/10 p-4 text-sm text-warning">Não foi possível identificar o treino no texto deste PDF. Seu plano atual foi mantido. Use o cadastro manual abaixo.</p> : null}
      <Stack>
        <Hero aria-label="Performance do treino">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex items-start gap-3">
              <IconTile icon={TrendingUp} colour={performanceTone === "danger" ? "red" : performanceTone === "good" ? "green" : "gray"} />
              <div>
                <h2>Performance do treino</h2>
                <p className="mt-0.5 text-sm text-text-muted">Confiança {confidenceLabel(performance.confidence)}{activePlan ? ` · ${activePlan.name}: ${activePlan.days.length} ${activePlan.days.length === 1 ? "dia" : "dias"}, ${activePlan.days.reduce((sum, day) => sum + day.exercises.length, 0)} exercícios` : ""}</p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{performance.primaryMessage}</p>
              </div>
            </div>
            <div className="text-center lg:pr-2">
              <p className="text-[40px] font-bold leading-[44px] tracking-[-0.03em] tabular-nums">{performance.score}</p>
              <p className="text-xs text-text-muted">pontuação</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-[14px] bg-surface-tertiary lg:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
            <Summary label="Tendência" value={trendLabel(performance.trend)} />
            <Summary label="Dias registrados" value={String(performance.trainedDays)} />
            <Summary label="Comparáveis" value={String(performance.comparableExercises)} />
            <Summary label="Subiram" value={String(performance.improvedExercises)} />
            <Summary label="Caíram" value={String(performance.declinedExercises)} />
          </div>
          {performance.alerts.length ? (
            <div className="mt-4 grid lg:grid-cols-2 lg:gap-x-6">
              {performance.alerts.slice(0, 2).map((alert) => (
                <div key={alert.message} className="flex gap-3 border-b border-hairline py-3 last:border-b-0 lg:border-b-0">
                  <div className={`mt-0.5 ${alert.type === "drop" || alert.type === "fatigue" ? "text-warning" : "text-text-muted"}`}>{alert.type === "drop" || alert.type === "fatigue" ? <ShieldAlert size={18} /> : <Activity size={18} />}</div>
                  <p className="text-sm leading-6 text-text-secondary">{alert.message}</p>
                </div>
              ))}
            </div>
          ) : null}
        </Hero>
        <Section title="Seus planos">
          {plans.length ? null : <GlassCard><p className="text-sm leading-6 text-text-muted">Nenhum treino ainda. Importe um PDF ou monte o treino em texto logo abaixo para começar a registrar as séries.</p></GlassCard>}
        {plans.map((plan) => (
          <GlassCard key={plan.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2>{plan.name}</h2>
                  {plan.isActive ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><Check size={13} aria-hidden="true" />Ativo</span> : null}
                </div>
                <p className="mt-1 text-sm text-text-muted">
                  {plan.sourceFileName ? `Importado de ${plan.sourceFileName}` : "Plano sem PDF anexado"} · {plan.createdAt.toLocaleDateString("pt-BR")}
                </p>
                {plan.notes ? <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">{plan.notes}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {!plan.isActive ? (
                  <form action={setActiveTrainingPlanAction}>
                    <input type="hidden" name="planId" value={plan.id} />
                    <button className="min-h-10 rounded-full bg-primary/15 px-4 text-sm font-semibold text-primary hover:bg-primary/20">Ativar</button>
                  </form>
                ) : null}
                <form action={deleteTrainingPlanAction}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <button className="inline-flex min-h-10 items-center gap-2 rounded-full bg-fill px-4 text-sm font-semibold text-danger hover:bg-danger/15">
                    <Trash2 size={15} />
                    Excluir
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-2">
              {plan.days.map((day) => (
                <div key={day.id} className="rounded-[14px] bg-surface-tertiary p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3>{day.name}</h3>
                      <p className="mt-0.5 text-sm text-text-muted">{day.focus ?? "Foco não identificado"}</p>
                    </div>
                    <span className="text-xs text-text-muted">{day.exercises.length} exercícios</span>
                  </div>
                  <div className="mt-2">
                    {day.exercises.map((exercise) => (
                      <div key={exercise.id} className="border-t border-hairline py-3 first:border-t-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{exercise.name}</p>
                            <p className="mt-0.5 text-xs text-text-muted">{exercise.muscleGroup ?? "grupo não definido"}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums">{exercise.sets ?? "-"} × {exercise.reps ?? "-"}</p>
                            <p className="mt-0.5 text-xs text-text-muted">{exercise.logs[0]?.loadKg ? `último ${formatNumber(exercise.logs[0].loadKg)} kg` : "sem carga registrada"}</p>
                          </div>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-text-muted">
                          {exercise.restSeconds ? `Descanso ${exercise.restSeconds}s. ` : ""}
                          {exercise.loadInstruction ?? ""}
                          {exercise.notes ? ` ${exercise.notes}` : ""}
                        </p>
                        <form action={logTrainingExerciseAction} className="mt-3 grid gap-2 md:grid-cols-[1.1fr_.7fr_.7fr_.7fr_.7fr_auto]">
                          <input type="hidden" name="exerciseId" value={exercise.id} />
                          <input name="date" type="date" defaultValue={todayInput()} className={smallInputClass} />
                          <input name="setsDone" inputMode="numeric" placeholder="séries" className={smallInputClass} />
                          <input name="repsDone" placeholder="reps ex: 10/9/8" className={smallInputClass} />
                          <input name="loadKg" inputMode="decimal" placeholder="kg" className={smallInputClass} />
                          <input name="rpe" inputMode="decimal" placeholder="RPE" className={smallInputClass} />
                          <button className="min-h-10 rounded-full bg-primary/15 px-4 text-sm font-semibold text-primary hover:bg-primary/20">Registrar</button>
                        </form>
                        {exercise.logs.length ? (
                          <div className="mt-2 grid">
                            {exercise.logs.map((log) => (
                              <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-1 text-xs text-text-muted">
                                <span className="tabular-nums">
                                  {log.date.toLocaleDateString("pt-BR")} · {log.setsDone ? `${log.setsDone} séries` : "séries -"} · {log.repsDone ?? "reps -"} · {log.loadKg ? `${formatNumber(log.loadKg)} kg` : "kg -"} {log.rpe ? `· RPE ${formatNumber(log.rpe)}` : ""}
                                </span>
                                <form action={deleteTrainingExerciseLogAction}>
                                  <input type="hidden" name="logId" value={log.id} />
                                  <button className="min-h-8 rounded-full px-2.5 text-xs text-danger hover:bg-danger/15">Apagar</button>
                                </form>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        ))}
        </Section>
        <Section title="Adicionar treino" columns={2}>
        <GlassCard>
          <div className="flex items-center gap-3">
            <IconTile icon={FileUp} colour="blue" />
            <div>
              <h2>Importar PDF</h2>
              <p className="mt-0.5 text-sm text-text-muted">PDF com texto selecionável, até 8 MB. Revise os exercícios após importar.</p>
            </div>
          </div>
          <form action={importTrainingPdfAction} className="mt-6 grid gap-4">
            <input
              name="trainingPdf"
              type="file"
              accept="application/pdf"
              required
              className="w-full rounded-[14px] bg-surface-tertiary px-4 py-5 text-sm text-text-secondary"
            />
            <button className="min-h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-light">
              Importar texto do PDF
            </button>
          </form>
          <p className="mt-4 text-xs leading-5 text-text-muted">
            A leitura reconhece dias da semana e exercícios numerados. Para PDFs digitalizados ou com outra estrutura, cadastre o treino manualmente.
          </p>
        </GlassCard>
      <GlassCard className="">
        <div className="flex items-start gap-3">
          <IconTile icon={Dumbbell} colour="red" />
          <div>
            <h2>Montar treino</h2>
            <p className="mt-0.5 max-w-3xl text-sm leading-6 text-text-muted">
              Cole seu treino em texto. Use linhas por dia e exercícios abaixo. Exemplo: Segunda - Pull; depois 1. Pulley frente - 3x | 6-10 | RPE 8.
            </p>
          </div>
        </div>
        <form action={createManualTrainingPlanAction} className="mt-5 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input name="name" className={inputClass} placeholder="Nome do treino. Ex: Pull Lower Push" />
            <input name="notes" className={inputClass} placeholder="Observação opcional" />
          </div>
          <textarea
            name="trainingText"
            required
            className="min-h-72 rounded-[14px] px-4 py-4 text-sm leading-6 outline-none"
            placeholder={`TREINO NOVO
SEGUNDA - PULL (Costas + Bíceps)
1. Pulley frente - 3x | 6-10 | RPE 7-8
2. Remada máquina - 3x | 8-12

TERÇA - LOWER (Quadríceps)
1. Agachamento Hack - 3x | 6-10
2. Leg press - 3x | 8-12`}
          />
          <button className="min-h-11 rounded-full bg-fill px-5 font-semibold hover:bg-fill-strong">
            Salvar treino manual
          </button>
        </form>
      </GlassCard>
        </Section>
      </Stack>
    </AppShell>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-4 py-3 shadow-[-1px_0_0_var(--hairline),0_-1px_0_var(--hairline)]">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 truncate text-[17px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const inputClass = "h-12 rounded-[14px] px-4 text-sm outline-none";
const smallInputClass = "h-10 min-w-0 rounded-[14px] px-3 text-sm outline-none";

function todayInput() {
  return appDateInputValue();
}

function trendLabel(value: string) {
  const labels: Record<string, string> = {
    improving: "subindo",
    stable: "estável",
    declining: "queda",
    insufficient: "poucos dados",
  };
  return labels[value] ?? value;
}
