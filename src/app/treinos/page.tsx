import { Dumbbell, FileUp, Trash2 } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/profile";
import { createManualTrainingPlanAction, deleteTrainingPlanAction, importTrainingPdfAction, setActiveTrainingPlanAction } from "./actions";

export default async function TrainingPage() {
  const { user } = await requireUserProfile();
  const plans = await prisma.trainingPlan.findMany({
    where: { userId: user.id },
    include: {
      days: {
        orderBy: { order: "asc" },
        include: { exercises: { orderBy: { order: "asc" } } },
      },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    take: 8,
  });
  const activePlan = plans.find((plan) => plan.isActive);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-lime-300">Treinos</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Plano de treino por PDF</h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Importe o PDF do seu treino. O ShapeOS transforma em dias, exercicios, series e repeticoes para usar como contexto no Coach e no relatorio.
          </p>
        </div>
        <div className="rounded-3xl border border-lime-300/20 bg-lime-300/10 px-5 py-4 text-right">
          <p className="text-2xl font-semibold text-lime-200">{activePlan ? activePlan.days.length : 0}</p>
          <p className="text-xs text-zinc-400">dias no plano ativo</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
        <GlassCard className="border-lime-300/25">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-lime-300/15 text-lime-300">
              <FileUp size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Importar PDF</h2>
              <p className="mt-1 text-sm text-zinc-500">PDF ate 8 MB. Depois confira se a IA leu tudo corretamente.</p>
            </div>
          </div>
          <form action={importTrainingPdfAction} className="mt-6 grid gap-4">
            <input
              name="trainingPdf"
              type="file"
              accept="application/pdf"
              required
              className="w-full rounded-3xl border border-dashed border-white/10 bg-black/25 px-4 py-5 text-sm text-zinc-300 file:mr-4 file:rounded-full file:border-0 file:bg-lime-300 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
            />
            <button className="rounded-full bg-lime-300 px-5 py-3 font-semibold text-black transition hover:bg-lime-200">
              Importar e interpretar com IA
            </button>
          </form>
          <p className="mt-4 text-xs leading-5 text-zinc-500">
            A IA pode errar em PDFs com foto, tabela quebrada ou baixa qualidade. Use como pre-preenchimento e revise antes de considerar oficial.
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-white/10 text-lime-300">
              <Dumbbell size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Resumo ativo</h2>
              <p className="mt-1 text-sm text-zinc-500">{activePlan ? activePlan.name : "Nenhum treino importado ainda."}</p>
            </div>
          </div>

          {activePlan ? (
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <Summary label="Dias" value={String(activePlan.days.length)} />
              <Summary label="Exercicios" value={String(activePlan.days.reduce((sum, day) => sum + day.exercises.length, 0))} />
              <Summary label="Origem" value={activePlan.sourceFileName ?? "manual"} />
            </div>
          ) : (
            <p className="mt-5 rounded-3xl bg-black/25 p-4 text-sm leading-6 text-zinc-400">
              Suba o PDF do treino para o ShapeOS usar volume, divisao muscular e frequencia como contexto para dieta, recuperacao e tendencia corporal.
            </p>
          )}
        </GlassCard>
      </div>

      <GlassCard className="mt-5 border-white/10">
        <div className="flex items-start gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-white/10 text-lime-300">
            <Dumbbell size={22} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Cadastrar manualmente</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
              Cole seu treino em texto. Use linhas por dia e exercicios abaixo. Exemplo: Segunda - Pull; depois 1. Pulley frente - 3x | 6-10 | RPE 8.
            </p>
          </div>
        </div>
        <form action={createManualTrainingPlanAction} className="mt-5 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input name="name" className={inputClass} placeholder="Nome do treino. Ex: Pull Lower Push" />
            <input name="notes" className={inputClass} placeholder="Observacao opcional" />
          </div>
          <textarea
            name="trainingText"
            required
            className="min-h-72 rounded-3xl border border-white/10 bg-black/30 px-4 py-4 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-300/50"
            placeholder={`TREINO NOVO
SEGUNDA - PULL (Costas + Biceps)
1. Pulley frente - 3x | 6-10 | RPE 7-8
2. Remada maquina - 3x | 8-12

TERCA - LOWER (Quadriceps)
1. Agachamento Hack - 3x | 6-10
2. Leg press - 3x | 8-12`}
          />
          <button className="rounded-full bg-white/10 px-5 py-3 font-semibold text-zinc-100 transition hover:bg-white/15">
            Salvar treino manual
          </button>
        </form>
      </GlassCard>

      <div className="mt-5 grid gap-4">
        {plans.map((plan) => (
          <GlassCard key={plan.id} className={plan.isActive ? "border-lime-300/30" : ""}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-semibold tracking-tight">{plan.name}</h2>
                  {plan.isActive ? <span className="rounded-full bg-lime-300/15 px-3 py-1 text-xs font-semibold text-lime-100">ativo</span> : null}
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  {plan.sourceFileName ? `Importado de ${plan.sourceFileName}` : "Plano sem PDF anexado"} - {plan.createdAt.toLocaleDateString("pt-BR")}
                </p>
                {plan.notes ? <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">{plan.notes}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {!plan.isActive ? (
                  <form action={setActiveTrainingPlanAction}>
                    <input type="hidden" name="planId" value={plan.id} />
                    <button className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/15">Ativar</button>
                  </form>
                ) : null}
                <form action={deleteTrainingPlanAction}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <button className="inline-flex items-center gap-2 rounded-full bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-400/20">
                    <Trash2 size={15} />
                    Excluir
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-2">
              {plan.days.map((day) => (
                <div key={day.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{day.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{day.focus ?? "Foco nao identificado"}</p>
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-400">{day.exercises.length} exercicios</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {day.exercises.map((exercise) => (
                      <div key={exercise.id} className="rounded-2xl bg-white/[0.04] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-zinc-100">{exercise.name}</p>
                            <p className="mt-1 text-xs text-zinc-500">{exercise.muscleGroup ?? "grupo nao definido"}</p>
                          </div>
                          <p className="text-sm font-semibold text-lime-200">{exercise.sets ?? "-"} x {exercise.reps ?? "-"}</p>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-zinc-500">
                          {exercise.restSeconds ? `Descanso ${exercise.restSeconds}s. ` : ""}
                          {exercise.loadInstruction ?? ""}
                          {exercise.notes ? ` ${exercise.notes}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        ))}
      </div>
    </AppShell>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

const inputClass = "h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none placeholder:text-zinc-600 focus:border-lime-300/50";
