import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadNutritionistReport } from "@/lib/data/nutritionist-report";
import { formatRecipePortions, groupDietMealItems } from "@/lib/diet-meal-display";
import { sumNutrients, toFoodNutrients } from "@/lib/nutrition";
import { requireUserProfile } from "@/lib/profile";
import { supplementDoseUnit, type SupplementType } from "@/lib/supplements";
import { waterPreferenceLabel } from "@/lib/water";
import { PrintReportButton } from "./print-button";
import { confidenceLabel, formatNumber } from "@/lib/common";

export default async function NutritionistReportPage() {
  const { user, profile } = await requireUserProfile();
  const {
    metrics, checkins, activePlan, activities, healthSummaries, supplementPlans, trainingPlan, bodySnapshots, currentBody,
    foodMonth, foodQuarter, foodSemester, planTotals, tdeeResult, tdeeValidation, bodyComposition, waterTarget, todayWaterMl,
    waterMonth, waterQuarter, waterSemester, activitiesTotals, averageConservativeActivityKcal, trainingPerformance,
  } = await loadNutritionistReport(user.id, profile);
  const heroMetrics = [
    { label: "Meta calórica", value: `${metrics.targets.calories} kcal` },
    { label: "TDEE hoje", value: `${tdeeResult.total} kcal` },
    { label: "BF atual", value: bodyComposition.bodyFatProgress.currentBodyFatPct == null ? "pendente" : `${formatNumber(bodyComposition.bodyFatProgress.currentBodyFatPct)}%` },
    { label: "Massa magra", value: bodyComposition.currentLeanMassKg == null ? "pendente" : `${formatNumber(bodyComposition.currentLeanMassKg)} kg` },
  ];

  return (
    <main className="shapeos-report-page min-h-screen bg-surface-primary px-4 py-8 text-text-primary print:bg-[#070807] print:px-0 print:py-0">
      <div className="shapeos-report-sheet panel mx-auto max-w-5xl overflow-hidden print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-black/40 px-6 py-5 backdrop-blur print:hidden">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white/8 px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-white/12">
            <ArrowLeft size={16} />
            Voltar
          </Link>
          <PrintReportButton />
        </div>

        <header className="relative overflow-hidden border-b border-hairline px-6 py-8 sm:px-8 print:px-7 print:py-7">

          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <Image src="/shapeos-logo.png" alt="ShapeOS" width={260} height={67} className="mb-7 h-auto w-56 sm:w-64 print:w-48" priority />
              <p className="text-sm text-text-muted">Relatório técnico para nutricionista</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl print:text-4xl">{user.name}</h1>
              <p className="mt-2 text-sm text-text-secondary">{user.email}</p>
            </div>
            <div className="rounded-[14px] bg-surface-tertiary p-4 text-left text-sm text-text-secondary">
              <p className="text-text-muted">Emitido em</p>
              <p className="font-semibold text-white">{formatDate(new Date())}</p>
              <p className="mt-3 text-text-muted">Janela de análise</p>
              <p className="font-semibold text-white">Mês atual + trimestre/semestre</p>
            </div>
          </div>

          <div className="relative mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
            {heroMetrics.map((metric) => (
              <div key={metric.label} className="rounded-[14px] bg-surface-tertiary p-4">
                <p className="text-xs font-medium text-text-muted">{metric.label}</p>
                <p className="mt-2 text-2xl font-black text-white">{metric.value}</p>
              </div>
            ))}
          </div>
          <p className="relative mt-6 rounded-[14px] bg-warning/10 px-4 py-3 text-xs leading-5 text-warning">
            Documento informativo gerado a partir de registros do usuário. Não substitui consulta, diagnóstico ou prescrição profissional.
          </p>
        </header>

        <div className="space-y-7 px-6 py-7 sm:px-8 print:px-7 print:py-6">
          <ReportSection title="1. Perfil e objetivos">
            <InfoGrid>
              <Info label="Sexo" value={profile.sex === "MALE" ? "Masculino" : "Feminino"} />
              <Info label="Idade" value={`${profile.age} anos`} />
              <Info label="Altura" value={`${formatNumber(profile.heightCm)} cm`} />
              <Info label="Peso atual" value={`${formatNumber(currentBody.weightKg)} kg`} />
              <Info label="Objetivo" value={goalLabel(profile.goal)} />
              <Info label="Conhecimento de dieta" value={experienceLabel(profile.experience)} />
              <Info label="Controle do app" value={profile.mode === "ADVANCED" ? "Manual avançado" : "Guiado"} />
              <Info label="Preferência alimentar" value={profile.dietPreference ?? "não informado"} />
            </InfoGrid>
            <TextBlock label="Restrições / alergias / condições" value={[
              `Restrições: ${profile.restrictions.join(", ") || "nenhuma"}`,
              `Alergias: ${profile.allergies.join(", ") || "nenhuma"}`,
              `Não gosta: ${profile.dislikedFoods.join(", ") || "nenhum"}`,
              `Condições relevantes: ${profile.medicalConditions.join(", ") || "nenhuma informada"}`,
            ].join("\n")} />
          </ReportSection>

          <ReportSection title="2. Cálculos metabólicos e metas">
            <InfoGrid>
              <Info label="BMR Mifflin-St Jeor" value={`${metrics.bmr} kcal`} />
              <Info label="Fator atividade" value={`${formatNumber(profile.activityFactor)} (${profile.tdeeCalculationMode})`} />
              <Info label="TDEE base" value={`${metrics.tdee} kcal`} />
              <Info label="TDEE efetivo hoje" value={`${tdeeResult.total} kcal`} />
              <Info label="Extras válidos hoje" value={`${tdeeResult.activityKcal} kcal`} />
              <Info label="Ajuste adaptativo" value={`${profile.tdeeAdjustmentKcal} kcal`} />
              <Info label="Confiança TDEE" value={confidenceLabel(tdeeValidation.confidence)} />
              <Info label="Meta calórica" value={`${metrics.targets.calories} kcal`} />
              <Info label="Déficit/superávit" value={`${metrics.targets.calories - metrics.tdee} kcal/dia`} />
            </InfoGrid>
            <InfoGrid>
              <Info label="Proteína" value={`${metrics.targets.proteinG} g (${formatNumber(profile.proteinPerKg ?? 1.8)} g/kg)`} />
              <Info label="Carboidratos" value={`${metrics.targets.carbsG} g`} />
              <Info label="Gorduras" value={`${metrics.targets.fatG} g (${formatNumber(profile.fatPerKg ?? 0.8)} g/kg)`} />
              <Info label="Fibra alvo" value={metrics.targets.fiberG ? `${metrics.targets.fiberG} g` : "não definido"} />
              <Info label="Sódio limite" value={metrics.targets.sodiumMg ? `${metrics.targets.sodiumMg} mg` : "não definido"} />
            </InfoGrid>
            <p className="mt-3 text-xs leading-5 text-text-muted">{tdeeValidation.message}</p>
          </ReportSection>

          <ReportSection title="3. Composição corporal">
            <InfoGrid>
              <Info label="BF atual" value={bodyComposition.bodyFatProgress.currentBodyFatPct == null ? "pendente" : `${formatNumber(bodyComposition.bodyFatProgress.currentBodyFatPct)}%`} />
              <Info label="Massa magra estimada" value={bodyComposition.currentLeanMassKg == null ? "pendente" : `${formatNumber(bodyComposition.currentLeanMassKg)} kg`} />
              <Info label="Massa gorda atual" value={bodyComposition.currentFatMassKg == null ? "pendente" : `${formatNumber(bodyComposition.currentFatMassKg)} kg`} />
              <Info label="BF alvo" value={bodyComposition.targetBodyFatPct == null ? "não definido" : `${formatNumber(bodyComposition.targetBodyFatPct)}%`} />
              <Info label="Gordura alvo" value={bodyComposition.targetFatMassKg == null ? "pendente" : `${formatNumber(bodyComposition.targetFatMassKg)} kg`} />
              <Info label="Gordura a perder" value={bodyComposition.fatMassToLoseKg == null ? "pendente" : `${formatNumber(bodyComposition.fatMassToLoseKg)} kg`} />
              <Info label="Faixa provável" value={bodyComposition.probableWeightRangeKg ? `${formatNumber(bodyComposition.probableWeightRangeKg.minKg)}-${formatNumber(bodyComposition.probableWeightRangeKg.maxKg)} kg` : "pendente"} />
              <Info label="Confiança corporal" value={confidenceLabel(bodyComposition.confidenceLabel)} />
            </InfoGrid>
            <p className="mt-3 text-xs leading-5 text-text-muted">{bodyComposition.recomposition.message}</p>
            <Table
              columns={["Data", "Peso", "Cintura", "Pescoço", "Quadril", "BF", "Massa magra", "Fonte"]}
              rows={bodySnapshots.map((item) => [
                formatDate(item.measuredAt),
                `${formatNumber(item.weightKg)} kg`,
                formatNullable(item.waistCm, "cm"),
                formatNullable(item.neckCm, "cm"),
                formatNullable(item.hipCm, "cm"),
                formatNullable(item.bodyFatPct, "%"),
                formatNullable(item.leanMassKg, "kg"),
                item.source,
              ])}
            />
          </ReportSection>

          <ReportSection title="4. Consumo alimentar por período">
            <InfoGrid>
              <Info label="Média kcal mês" value={`${Math.round(foodMonth.average.kcal)} kcal/dia`} />
              <Info label="Proteína mês" value={`${formatNumber(foodMonth.average.proteinG)} g/dia`} />
              <Info label="Dias lançados mês" value={`${foodMonth.registeredDays}`} />
              <Info label="Média kcal trimestre" value={`${Math.round(foodQuarter.average.kcal)} kcal/dia`} />
              <Info label="Dias lançados trimestre" value={`${foodQuarter.registeredDays}`} />
              <Info label="Média kcal semestre" value={`${Math.round(foodSemester.average.kcal)} kcal/dia`} />
              <Info label="Dias lançados semestre" value={`${foodSemester.registeredDays}`} />
            </InfoGrid>
            <p className="mt-3 text-xs leading-5 text-text-muted">
              Alimentação e água usam somente dias com registro. Dias sem lançamento não entram como zero.
            </p>
            <Table
              columns={["Período", "Janela", "Dias", "Kcal média", "Proteína", "Carbo", "Gordura", "Fibra", "Sódio"]}
              rows={[foodMonth, foodQuarter, foodSemester].map((summary) => [
                periodTitle(summary.period.key),
                summary.period.label,
                String(summary.registeredDays),
                `${Math.round(summary.average.kcal)} kcal`,
                `${formatNumber(summary.average.proteinG)} g`,
                `${formatNumber(summary.average.carbsG)} g`,
                `${formatNumber(summary.average.fatG)} g`,
                `${formatNumber(summary.average.fiberG)} g`,
                `${formatNumber(summary.average.sodiumMg)} mg`,
              ])}
            />
            <Table
              columns={["Data", "Kcal", "Proteína", "Carbo", "Gordura", "Fibra", "Sódio"]}
              rows={foodMonth.dayTotals.slice(0, 14).map((day) => [
                formatDate(day.date),
                String(Math.round(day.totals.kcal)),
                `${formatNumber(day.totals.proteinG)} g`,
                `${formatNumber(day.totals.carbsG)} g`,
                `${formatNumber(day.totals.fatG)} g`,
                `${formatNumber(day.totals.fiberG)} g`,
                `${formatNumber(day.totals.sodiumMg)} mg`,
              ])}
            />
          </ReportSection>

          <ReportSection title="5. Plano alimentar ativo">
            {activePlan ? (
              <>
                <InfoGrid>
                  <Info label="Nome" value={activePlan.name} />
                  <Info label="Meta kcal" value={`${activePlan.targetCalories} kcal`} />
                  <Info label="Proteína alvo" value={`${formatNumber(activePlan.targetProteinG)} g`} />
                  <Info label="Carbo alvo" value={`${formatNumber(activePlan.targetCarbsG)} g`} />
                  <Info label="Gordura alvo" value={`${formatNumber(activePlan.targetFatG)} g`} />
                  <Info label="Total calculado" value={planTotals ? `${Math.round(planTotals.kcal)} kcal` : "pendente"} />
                </InfoGrid>
                {activePlan.meals.map((meal) => (
                  <div key={meal.id} className="mt-4 break-inside-avoid">
                    <h3 className="font-semibold text-text-primary">{meal.name}</h3>
                    <Table
                      compact
                      columns={["Alimento", "Gramas", "Kcal", "P", "C", "G"]}
                      rows={groupDietMealItems(meal.items).map((group) => {
                        const n = sumNutrients(group.items.map((item) => ({ food: toFoodNutrients(item.food), grams: item.grams })));
                        const item = group.items[0];
                        return [
                          group.kind === "recipe" ? group.name : item.food.name,
                          group.kind === "recipe" ? formatRecipePortions(group.portions) : `${formatNumber(item.grams)} g`,
                          String(Math.round(n.kcal)),
                          `${formatNumber(n.proteinG)} g`,
                          `${formatNumber(n.carbsG)} g`,
                          `${formatNumber(n.fatG)} g`,
                        ];
                      })}
                    />
                  </div>
                ))}
              </>
            ) : <p className="text-sm text-text-muted">Nenhum plano alimentar ativo.</p>}
          </ReportSection>

          <ReportSection title="6. Check-ins semanais">
            <Table
              columns={["Semana", "Peso médio", "Cintura", "Aderência", "Fome", "Energia", "Sono", "Treino", "Obs."]}
              rows={checkins.map((item) => [
                formatDate(item.weekStart),
                `${formatNumber(item.averageWeightKg)} kg`,
                formatNullable(item.waistCm, "cm"),
                `${formatNumber(item.adherencePct)}%`,
                `${item.hunger}/10`,
                `${item.energy}/10`,
                `${item.sleep}/10`,
                item.trainingDone ? "sim" : "não",
                item.notes ?? "",
              ])}
            />
          </ReportSection>

          <ReportSection title="7. Comparativo visual dos check-ins">
            {checkins.some((checkin) => checkin.bodyPhotos.length) ? (
              <div className="grid gap-4">
                {checkins.filter((checkin) => checkin.bodyPhotos.length).map((checkin, checkinIndex) => (
                  <div key={checkin.id} className="break-inside-avoid rounded-[14px] bg-surface-tertiary p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Semana {checkins.length - checkinIndex} - check-in de {formatDate(checkin.weekStart)}</p>
                        <p className="mt-1 text-xs text-text-muted">
                          Peso {formatNumber(checkin.averageWeightKg)} kg
                          {checkin.waistCm ? ` - cintura ${formatNumber(checkin.waistCm)} cm` : ""}
                          {` - adesão ${formatNumber(checkin.adherencePct)}%`}
                        </p>
                      </div>
                      <span className="text-xs text-text-muted">{checkin.bodyPhotos.length}/8 fotos</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 print:grid-cols-4">
                      {checkin.bodyPhotos.map((photo, index) => (
                        <figure key={photo.id} className="overflow-hidden rounded-[12px] bg-surface-primary">
                          <Image src={bodyPhotoSrc(photo)} alt={`Foto ${index + 1} do check-in ${formatDate(checkin.weekStart)}`} width={360} height={480} unoptimized className="aspect-[3/4] w-full object-cover" />
                          <figcaption className="px-2 py-2 text-[10px] text-text-muted">
                            Foto {index + 1} - {formatDate(checkin.weekStart)}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-text-muted">Nenhuma foto corporal anexada aos check-ins.</p>}
          </ReportSection>

          <ReportSection title="8. Atividade, hidratação e saúde integrada">
            <InfoGrid>
              <Info label="Atividades registradas" value={`${activities.length}`} />
              <Info label="Kcal atividade bruta" value={`${activitiesTotals.raw} kcal / 30 dias`} />
              <Info label="Kcal conservadora" value={`${activitiesTotals.conservative} kcal / 30 dias`} />
              <Info label="Média conservadora" value={`${averageConservativeActivityKcal} kcal/dia`} />
              <Info label="Extras válidos hoje" value={`${tdeeResult.activityKcal} kcal`} />
              <Info label="Água hoje" value={`${todayWaterMl} ml`} />
              <Info label="Meta água" value={`${waterTarget} ml/dia (${waterPreferenceLabel(profile.waterPreference)})`} />
              <Info label="Média água mês" value={`${waterMonth.averageMl} ml/dia`} />
              <Info label="Dias água mês" value={`${waterMonth.registeredDays}`} />
              <Info label="Média água trimestre" value={`${waterQuarter.averageMl} ml/dia`} />
              <Info label="Dias água trimestre" value={`${waterQuarter.registeredDays}`} />
              <Info label="Média água semestre" value={`${waterSemester.averageMl} ml/dia`} />
              <Info label="Dias água semestre" value={`${waterSemester.registeredDays}`} />
              <Info label="Dias Apple/Health" value={`${healthSummaries.length}`} />
            </InfoGrid>
            <p className="mt-3 text-xs leading-5 text-text-muted">
              TDEE efetivo hoje usa apenas atividades válidas registradas hoje. Médias de alimentação e água consideram apenas dias lançados no período.
            </p>
            <Table
              compact
              columns={["Data", "Atividade", "Duração", "Distância", "Kcal cons.", "Conta TDEE"]}
              rows={activities.slice(0, 20).map((item) => [
                formatDate(item.date),
                item.name,
                `${item.durationMinutes} min`,
                item.distanceKm ? `${formatNumber(item.distanceKm)} km` : "-",
                `${Math.round(item.conservativeCaloriesKcal ?? item.caloriesKcal)}`,
                item.countsTowardTdee ? "sim" : "não",
              ])}
            />
          </ReportSection>

          <ReportSection title="9. Treino ativo">
            {trainingPlan ? (
              <>
                <InfoGrid>
                  <Info label="Nome" value={trainingPlan.name} />
                  <Info label="Dias" value={`${trainingPlan.days.length}`} />
                  <Info label="Exercícios" value={`${trainingPlan.days.reduce((sum, day) => sum + day.exercises.length, 0)}`} />
                  <Info label="Origem" value={trainingPlan.sourceFileName ?? "manual"} />
                  <Info label="Score performance" value={`${trainingPerformance.score}`} />
                  <Info label="Tendência" value={trainingTrendLabel(trainingPerformance.trend)} />
                  <Info label="Confiança" value={confidenceLabel(trainingPerformance.confidence)} />
                  <Info label="Dias registrados" value={`${trainingPerformance.trainedDays}`} />
                  <Info label="Exercícios comparados" value={`${trainingPerformance.comparableExercises}`} />
                  <Info label="Subiram / caíram" value={`${trainingPerformance.improvedExercises} / ${trainingPerformance.declinedExercises}`} />
                  <Info label="RPE médio" value={trainingPerformance.averageRpe == null ? "pendente" : `${formatNumber(trainingPerformance.averageRpe)}`} />
                </InfoGrid>
                <p className="mt-3 text-xs leading-5 text-text-muted">{trainingPerformance.primaryMessage}</p>
                {trainingPerformance.alerts.length ? (
                  <TextBlock label="Alertas de performance" value={trainingPerformance.alerts.map((alert) => alert.message).join("\n")} />
                ) : null}
                {trainingPlan.notes ? <p className="mt-3 text-xs leading-5 text-text-muted">{trainingPlan.notes}</p> : null}
                {trainingPlan.days.map((day) => (
                  <div key={day.id} className="mt-4 break-inside-avoid">
                    <h3 className="font-semibold text-text-primary">{day.name} {day.focus ? `- ${day.focus}` : ""}</h3>
                    <Table
                      compact
                      columns={["Exercício", "Grupo", "Séries", "Reps", "Descanso", "Carga/obs."]}
                      rows={day.exercises.map((exercise) => [
                        exercise.name,
                        exercise.muscleGroup ?? "-",
                        exercise.sets ?? "-",
                        exercise.reps ?? "-",
                        exercise.restSeconds ? `${exercise.restSeconds}s` : "-",
                        [
                          exercise.loadInstruction,
                          exercise.notes,
                          exercise.logs[0]?.loadKg ? `última carga ${formatNumber(exercise.logs[0].loadKg)} kg` : null,
                          exercise.logs[0]?.repsDone ? `reps ${exercise.logs[0].repsDone}` : null,
                        ].filter(Boolean).join(" - "),
                      ])}
                    />
                  </div>
                ))}
              </>
            ) : <p className="text-sm text-text-muted">Nenhum plano de treino importado.</p>}
          </ReportSection>

          <ReportSection title="10. Suplementos monitorados">
            {supplementPlans.length ? (
              <Table
                columns={["Suplemento", "Protocolo", "Dose/dia", "Início", "Ativo", "Registros recentes"]}
                rows={supplementPlans.map((plan) => [
                  plan.name,
                  plan.protocol,
                  `${formatNumber(plan.dailyDoseG)} ${supplementDoseUnit(plan.type as SupplementType, plan.dailyDoseG)}`,
                  formatDate(plan.startedAt),
                  plan.isActive ? "sim" : "não",
                  plan.logs.map((log) => `${formatDate(log.date)} ${formatNumber(log.doseG)} ${supplementDoseUnit(plan.type as SupplementType, log.doseG)}`).join("; "),
                ])}
              />
            ) : <p className="text-sm text-text-muted">Nenhum suplemento registrado.</p>}
          </ReportSection>
        </div>
      </div>
    </main>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-[14px] bg-surface-tertiary p-5">
      <h2 className="flex items-center gap-3 border-b border-hairline pb-3 text-lg font-bold text-white">
        <span className="size-2 rounded-full bg-text-muted" />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">{children}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-hairline bg-black/25 px-3 py-3 shadow-inner shadow-white/5">
      <p className="text-[10px] font-semibold text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 rounded-[18px] border border-hairline bg-black/25 px-3 py-3">
      <p className="text-[10px] font-semibold text-text-muted">{label}</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-text-secondary">{value}</p>
    </div>
  );
}

function Table({ columns, rows, compact = false }: { columns: string[]; rows: string[][]; compact?: boolean }) {
  if (!rows.length) return <p className="text-sm text-text-muted">Sem dados registrados.</p>;

  return (
    <div className="mt-3 overflow-x-auto rounded-[18px] border border-hairline">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b border-hairline bg-fill px-2 py-2 font-semibold text-text-primary">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="odd:bg-white/[0.025]">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className={`border-b border-white/8 px-2 align-top text-text-secondary ${compact ? "py-1.5" : "py-2"}`}>{cell || "-"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function periodTitle(value: string) {
  const labels: Record<string, string> = { month: "Mês atual", quarter: "Trimestre", semester: "Semestre" };
  return labels[value] ?? value;
}

function bodyPhotoSrc(photo: { imageMimeType: string; imageData: Uint8Array }) {
  return `data:${photo.imageMimeType};base64,${Buffer.from(photo.imageData).toString("base64")}`;
}

function formatNullable(value: number | null | undefined, unit: string) {
  return typeof value === "number" ? `${formatNumber(value)} ${unit}` : "-";
}

function goalLabel(value: string) {
  const labels: Record<string, string> = { FAT_LOSS: "Perda de gordura", MAINTENANCE: "Manutenção", MUSCLE_GAIN: "Ganho de massa" };
  return labels[value] ?? value;
}

function experienceLabel(value: string) {
  const labels: Record<string, string> = { BEGINNER: "Precisa de guia", INTERMEDIATE: "Intermediário", ADVANCED: "Autônomo" };
  return labels[value] ?? value;
}

function trainingTrendLabel(value: string) {
  const labels: Record<string, string> = {
    improving: "subindo",
    stable: "estável",
    declining: "queda",
    insufficient: "poucos dados",
  };
  return labels[value] ?? value;
}
