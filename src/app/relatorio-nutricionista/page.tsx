import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { bodyStateFromLatestSnapshot, recalculateBodyCompositionSnapshots } from "@/lib/body-composition";
import { buildBodyCompositionProjection } from "@/lib/bodyCompositionEngine";
import { sumNutrients, type FoodNutrients } from "@/lib/nutrition";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics, endOfToday, requireUserProfile, startOfToday } from "@/lib/profile";
import { effectiveTdee, validateTdeeTrend } from "@/lib/tdee";
import { waterPreferenceLabel, waterTargetMl } from "@/lib/water";
import { PrintReportButton } from "./print-button";

export default async function NutritionistReportPage() {
  const { user, profile } = await requireUserProfile();
  let metrics = computeProfileMetrics(profile);
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [rawBodySnapshots, checkins, foodLogs, activePlan, activities, waterLogs, healthSummaries, supplementPlans] = await Promise.all([
    prisma.bodyCompositionSnapshot.findMany({ where: { userId: user.id }, orderBy: { measuredAt: "desc" }, take: 12 }),
    prisma.weeklyCheckin.findMany({ where: { userId: user.id }, orderBy: { weekStart: "desc" }, take: 12 }),
    prisma.foodLog.findMany({
      where: { userId: user.id, date: { gte: since } },
      include: { items: { include: { food: true } } },
      orderBy: { date: "desc" },
      take: 30,
    }),
    prisma.dietPlan.findFirst({
      where: { userId: user.id, isActive: true },
      include: { meals: { include: { items: { include: { food: true } } }, orderBy: { order: "asc" } } },
    }),
    prisma.physicalActivityLog.findMany({ where: { userId: user.id, date: { gte: since } }, orderBy: { date: "desc" }, take: 60 }),
    prisma.waterLog.findMany({ where: { userId: user.id, date: { gte: since } }, orderBy: { date: "desc" }, take: 120 }),
    prisma.healthDailySummary.findMany({ where: { userId: user.id, date: { gte: since } }, orderBy: { date: "desc" }, take: 30 }),
    prisma.supplementPlan.findMany({
      where: { userId: user.id },
      include: { logs: { orderBy: { date: "desc" }, take: 10 }, periods: { orderBy: { startDate: "desc" }, take: 5 } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const bodySnapshots = recalculateBodyCompositionSnapshots(rawBodySnapshots, { sex: metrics.sex, heightCm: profile.heightCm });
  const latestBody = bodySnapshots[0];
  const currentBody = bodyStateFromLatestSnapshot(profile, bodySnapshots);
  metrics = computeProfileMetrics(profile, currentBody);
  const recentFoodTotals = foodLogs.map((log) => ({
    date: log.date,
    totals: sumNutrients(log.items.map((item) => ({ food: toFoodNutrients(item.food), grams: item.grams }))),
  }));
  const averageIntake = averageNutrition(recentFoodTotals.map((day) => day.totals));
  const planTotals = activePlan ? sumNutrients(activePlan.meals.flatMap((meal) => meal.items.map((item) => ({ food: toFoodNutrients(item.food), grams: item.grams })))) : null;
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const todayActivities = activities.filter((activity) => activity.date >= todayStart && activity.date <= todayEnd);
  const tdeeResult = effectiveTdee({
    bmr: metrics.bmr,
    activityFactor: profile.activityFactor,
    adjustmentKcal: profile.tdeeAdjustmentKcal,
    mode: profile.tdeeCalculationMode,
    activities: todayActivities,
  });
  const tdeeValidation = validateTdeeTrend({
    tdee: metrics.tdee,
    averageIntakeKcal: Math.round(averageIntake.kcal),
    checkins: [...checkins].reverse(),
  });
  const bodyComposition = buildBodyCompositionProjection({
    currentWeightKg: currentBody.weightKg,
    currentWaistCm: currentBody.waistCm,
    currentBodyFatPct: latestBody?.bodyFatPct ?? metrics.bodyFat.percentage,
    targetBodyFatPct: profile.targetBodyFatPct,
    targetWaistCm: profile.targetWaistCm,
    targetDate: profile.targetDate,
    checkins: [...checkins].reverse(),
    snapshots: bodySnapshots,
    proteinHitRate: proteinHitRate(recentFoodTotals, metrics.targets.proteinG),
    deficitPct: metrics.tdee ? Math.round(((metrics.tdee - metrics.targets.calories) / metrics.tdee) * 100) : null,
  });
  const waterTarget = waterTargetMl(currentBody.weightKg, profile.waterPreference);
  const todayWaterMl = waterLogs.filter((log) => log.date >= todayStart && log.date <= todayEnd).reduce((sum, log) => sum + log.amountMl, 0);
  const waterTotalsByDay = groupWaterByDay(waterLogs);
  const totalWaterMl = waterLogs.reduce((sum, log) => sum + log.amountMl, 0);
  const averageWaterOnLoggedDaysMl = average([...waterTotalsByDay.values()]);
  const averageWaterOverPeriodMl = Math.round(totalWaterMl / 30);
  const activitiesTotals = {
    raw: Math.round(activities.reduce((sum, item) => sum + item.caloriesKcal, 0)),
    conservative: Math.round(activities.reduce((sum, item) => sum + (item.conservativeCaloriesKcal ?? item.caloriesKcal), 0)),
    todayConservative: Math.round(todayActivities.reduce((sum, item) => sum + (item.conservativeCaloriesKcal ?? item.caloriesKcal), 0)),
  };
  const averageConservativeActivityKcal = Math.round(activitiesTotals.conservative / 30);
  const heroMetrics = [
    { label: "Meta calorica", value: `${metrics.targets.calories} kcal` },
    { label: "TDEE hoje", value: `${tdeeResult.total} kcal` },
    { label: "BF atual", value: bodyComposition.bodyFatProgress.currentBodyFatPct == null ? "pendente" : `${formatNumber(bodyComposition.bodyFatProgress.currentBodyFatPct)}%` },
    { label: "Massa magra", value: bodyComposition.currentLeanMassKg == null ? "pendente" : `${formatNumber(bodyComposition.currentLeanMassKg)} kg` },
  ];

  return (
    <main className="min-h-screen bg-[#070807] px-4 py-8 text-zinc-100 print:bg-[#070807] print:px-0 print:py-0">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[36px] border border-lime-300/20 bg-[#10110f] shadow-2xl shadow-lime-950/20 print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-6 py-5 backdrop-blur print:hidden">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/12">
            <ArrowLeft size={16} />
            Voltar
          </Link>
          <PrintReportButton />
        </div>

        <header className="relative overflow-hidden border-b border-lime-300/20 bg-[radial-gradient(circle_at_15%_0%,rgba(184,255,0,.22),transparent_35%),linear-gradient(135deg,#080908_0%,#151712_58%,#0b0c0b_100%)] px-6 py-8 sm:px-8 print:px-7 print:py-7">
          <div className="absolute right-[-90px] top-[-110px] size-72 rounded-full border border-lime-300/20 bg-lime-300/10 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <Image src="/shapeos-logo.png" alt="ShapeOS" width={260} height={67} className="mb-7 h-auto w-56 sm:w-64 print:w-48" priority />
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-lime-300">Relatorio tecnico para nutricionista</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl print:text-4xl">{user.name}</h1>
              <p className="mt-2 text-sm text-zinc-300">{user.email}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/35 p-4 text-left text-sm text-zinc-300 shadow-2xl shadow-black/25 backdrop-blur">
              <p className="text-zinc-500">Emitido em</p>
              <p className="font-semibold text-white">{formatDate(new Date())}</p>
              <p className="mt-3 text-zinc-500">Janela de analise</p>
              <p className="font-semibold text-white">Ultimos 30 dias</p>
            </div>
          </div>

          <div className="relative mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
            {heroMetrics.map((metric) => (
              <div key={metric.label} className="rounded-[22px] border border-white/10 bg-white/[0.07] p-4 shadow-inner shadow-white/5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{metric.label}</p>
                <p className="mt-2 text-2xl font-black text-white">{metric.value}</p>
              </div>
            ))}
          </div>
          <p className="relative mt-6 rounded-[22px] border border-amber-300/45 bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100">
            Documento informativo gerado a partir de registros do usuario. Nao substitui consulta, diagnostico ou prescricao profissional.
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
              <Info label="Experiencia" value={experienceLabel(profile.experience)} />
              <Info label="Modo" value={profile.mode === "ADVANCED" ? "Avancado" : "Guiado"} />
              <Info label="Preferencia alimentar" value={profile.dietPreference ?? "nao informado"} />
            </InfoGrid>
            <TextBlock label="Restricoes / alergias / condicoes" value={[
              `Restricoes: ${profile.restrictions.join(", ") || "nenhuma"}`,
              `Alergias: ${profile.allergies.join(", ") || "nenhuma"}`,
              `Nao gosta: ${profile.dislikedFoods.join(", ") || "nenhum"}`,
              `Condicoes relevantes: ${profile.medicalConditions.join(", ") || "nenhuma informada"}`,
            ].join("\n")} />
          </ReportSection>

          <ReportSection title="2. Calculos metabolicos e metas">
            <InfoGrid>
              <Info label="BMR Mifflin-St Jeor" value={`${metrics.bmr} kcal`} />
              <Info label="Fator atividade" value={`${formatNumber(profile.activityFactor)} (${profile.tdeeCalculationMode})`} />
              <Info label="TDEE base" value={`${metrics.tdee} kcal`} />
              <Info label="TDEE efetivo hoje" value={`${tdeeResult.total} kcal`} />
              <Info label="Extras validos hoje" value={`${tdeeResult.activityKcal} kcal`} />
              <Info label="Ajuste adaptativo" value={`${profile.tdeeAdjustmentKcal} kcal`} />
              <Info label="Confianca TDEE" value={confidenceLabel(tdeeValidation.confidence)} />
              <Info label="Meta calorica" value={`${metrics.targets.calories} kcal`} />
              <Info label="Deficit/superavit" value={`${metrics.targets.calories - metrics.tdee} kcal/dia`} />
            </InfoGrid>
            <InfoGrid>
              <Info label="Proteina" value={`${metrics.targets.proteinG} g (${formatNumber(profile.proteinPerKg ?? 1.8)} g/kg)`} />
              <Info label="Carboidratos" value={`${metrics.targets.carbsG} g`} />
              <Info label="Gorduras" value={`${metrics.targets.fatG} g (${formatNumber(profile.fatPerKg ?? 0.8)} g/kg)`} />
              <Info label="Fibra alvo" value={metrics.targets.fiberG ? `${metrics.targets.fiberG} g` : "nao definido"} />
              <Info label="Sodio limite" value={metrics.targets.sodiumMg ? `${metrics.targets.sodiumMg} mg` : "nao definido"} />
            </InfoGrid>
            <p className="mt-3 text-xs leading-5 text-zinc-400">{tdeeValidation.message}</p>
          </ReportSection>

          <ReportSection title="3. Composicao corporal">
            <InfoGrid>
              <Info label="BF atual" value={bodyComposition.bodyFatProgress.currentBodyFatPct == null ? "pendente" : `${formatNumber(bodyComposition.bodyFatProgress.currentBodyFatPct)}%`} />
              <Info label="Massa magra estimada" value={bodyComposition.currentLeanMassKg == null ? "pendente" : `${formatNumber(bodyComposition.currentLeanMassKg)} kg`} />
              <Info label="Massa gorda atual" value={bodyComposition.currentFatMassKg == null ? "pendente" : `${formatNumber(bodyComposition.currentFatMassKg)} kg`} />
              <Info label="BF alvo" value={bodyComposition.targetBodyFatPct == null ? "nao definido" : `${formatNumber(bodyComposition.targetBodyFatPct)}%`} />
              <Info label="Gordura alvo" value={bodyComposition.targetFatMassKg == null ? "pendente" : `${formatNumber(bodyComposition.targetFatMassKg)} kg`} />
              <Info label="Gordura a perder" value={bodyComposition.fatMassToLoseKg == null ? "pendente" : `${formatNumber(bodyComposition.fatMassToLoseKg)} kg`} />
              <Info label="Faixa provavel" value={bodyComposition.probableWeightRangeKg ? `${formatNumber(bodyComposition.probableWeightRangeKg.minKg)}-${formatNumber(bodyComposition.probableWeightRangeKg.maxKg)} kg` : "pendente"} />
              <Info label="Confianca corporal" value={bodyComposition.confidenceLabel} />
            </InfoGrid>
            <p className="mt-3 text-xs leading-5 text-zinc-400">{bodyComposition.recomposition.message}</p>
            <Table
              columns={["Data", "Peso", "Cintura", "Pescoco", "Quadril", "BF", "Massa magra", "Fonte"]}
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

          <ReportSection title="4. Consumo alimentar recente">
            <InfoGrid>
              <Info label="Media kcal" value={`${Math.round(averageIntake.kcal)} kcal/dia`} />
              <Info label="Media proteina" value={`${formatNumber(averageIntake.proteinG)} g/dia`} />
              <Info label="Media carbo" value={`${formatNumber(averageIntake.carbsG)} g/dia`} />
              <Info label="Media gordura" value={`${formatNumber(averageIntake.fatG)} g/dia`} />
              <Info label="Media fibra" value={`${formatNumber(averageIntake.fiberG)} g/dia`} />
              <Info label="Media sodio" value={`${formatNumber(averageIntake.sodiumMg)} mg/dia`} />
            </InfoGrid>
            <Table
              columns={["Data", "Kcal", "Proteina", "Carbo", "Gordura", "Fibra", "Sodio"]}
              rows={recentFoodTotals.slice(0, 14).map((day) => [
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
                  <Info label="Proteina alvo" value={`${formatNumber(activePlan.targetProteinG)} g`} />
                  <Info label="Carbo alvo" value={`${formatNumber(activePlan.targetCarbsG)} g`} />
                  <Info label="Gordura alvo" value={`${formatNumber(activePlan.targetFatG)} g`} />
                  <Info label="Total calculado" value={planTotals ? `${Math.round(planTotals.kcal)} kcal` : "pendente"} />
                </InfoGrid>
                {activePlan.meals.map((meal) => (
                  <div key={meal.id} className="mt-4 break-inside-avoid">
                    <h3 className="font-semibold text-zinc-100">{meal.name}</h3>
                    <Table
                      compact
                      columns={["Alimento", "Gramas", "Kcal", "P", "C", "G"]}
                      rows={meal.items.map((item) => {
                        const n = sumNutrients([{ food: toFoodNutrients(item.food), grams: item.grams }]);
                        return [item.food.name, `${formatNumber(item.grams)} g`, String(Math.round(n.kcal)), `${formatNumber(n.proteinG)} g`, `${formatNumber(n.carbsG)} g`, `${formatNumber(n.fatG)} g`];
                      })}
                    />
                  </div>
                ))}
              </>
            ) : <p className="text-sm text-zinc-500">Nenhum plano alimentar ativo.</p>}
          </ReportSection>

          <ReportSection title="6. Check-ins semanais">
            <Table
              columns={["Semana", "Peso medio", "Cintura", "Aderencia", "Fome", "Energia", "Sono", "Treino", "Obs."]}
              rows={checkins.map((item) => [
                formatDate(item.weekStart),
                `${formatNumber(item.averageWeightKg)} kg`,
                formatNullable(item.waistCm, "cm"),
                `${formatNumber(item.adherencePct)}%`,
                `${item.hunger}/10`,
                `${item.energy}/10`,
                `${item.sleep}/10`,
                item.trainingDone ? "sim" : "nao",
                item.notes ?? "",
              ])}
            />
          </ReportSection>

          <ReportSection title="7. Atividade, hidratacao e saude integrada">
            <InfoGrid>
              <Info label="Atividades registradas" value={`${activities.length}`} />
              <Info label="Kcal atividade bruta" value={`${activitiesTotals.raw} kcal / 30 dias`} />
              <Info label="Kcal conservadora" value={`${activitiesTotals.conservative} kcal / 30 dias`} />
              <Info label="Media conservadora" value={`${averageConservativeActivityKcal} kcal/dia`} />
              <Info label="Extras validos hoje" value={`${tdeeResult.activityKcal} kcal`} />
              <Info label="Agua hoje" value={`${todayWaterMl} ml`} />
              <Info label="Meta agua" value={`${waterTarget} ml/dia (${waterPreferenceLabel(profile.waterPreference)})`} />
              <Info label="Media dias registrados" value={`${Math.round(averageWaterOnLoggedDaysMl)} ml/dia`} />
              <Info label="Media 30 dias" value={`${averageWaterOverPeriodMl} ml/dia`} />
              <Info label="Dias com agua" value={`${waterTotalsByDay.size}/30`} />
              <Info label="Dias Apple/Health" value={`${healthSummaries.length}`} />
            </InfoGrid>
            <p className="mt-3 text-xs leading-5 text-zinc-400">
              TDEE efetivo hoje usa apenas atividades validas registradas hoje. O total de 30 dias serve para analise de tendencia e nao deve ser tratado como gasto diario fixo.
            </p>
            <Table
              compact
              columns={["Data", "Atividade", "Duracao", "Distancia", "Kcal cons.", "Conta TDEE"]}
              rows={activities.slice(0, 20).map((item) => [
                formatDate(item.date),
                item.name,
                `${item.durationMinutes} min`,
                item.distanceKm ? `${formatNumber(item.distanceKm)} km` : "-",
                `${Math.round(item.conservativeCaloriesKcal ?? item.caloriesKcal)}`,
                item.countsTowardTdee ? "sim" : "nao",
              ])}
            />
          </ReportSection>

          <ReportSection title="8. Suplementos monitorados">
            {supplementPlans.length ? (
              <Table
                columns={["Suplemento", "Protocolo", "Dose/dia", "Inicio", "Ativo", "Registros recentes"]}
                rows={supplementPlans.map((plan) => [
                  plan.name,
                  plan.protocol,
                  `${formatNumber(plan.dailyDoseG)} g`,
                  formatDate(plan.startedAt),
                  plan.isActive ? "sim" : "nao",
                  plan.logs.map((log) => `${formatDate(log.date)} ${formatNumber(log.doseG)}g`).join("; "),
                ])}
              />
            ) : <p className="text-sm text-zinc-500">Nenhum suplemento registrado.</p>}
          </ReportSection>
        </div>
      </div>
    </main>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/20">
      <h2 className="flex items-center gap-3 border-b border-white/10 pb-3 text-lg font-bold text-white">
        <span className="size-2 rounded-full bg-lime-300 shadow-[0_0_16px_rgba(184,255,0,.75)]" />
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
    <div className="rounded-[18px] border border-white/10 bg-black/25 px-3 py-3 shadow-inner shadow-white/5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 rounded-[18px] border border-white/10 bg-black/25 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-200">{value}</p>
    </div>
  );
}

function Table({ columns, rows, compact = false }: { columns: string[]; rows: string[][]; compact?: boolean }) {
  if (!rows.length) return <p className="text-sm text-zinc-500">Sem dados registrados.</p>;

  return (
    <div className="mt-3 overflow-x-auto rounded-[18px] border border-white/10">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b border-white/10 bg-lime-300/10 px-2 py-2 font-semibold text-lime-100">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="odd:bg-white/[0.025]">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className={`border-b border-white/8 px-2 align-top text-zinc-200 ${compact ? "py-1.5" : "py-2"}`}>{cell || "-"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type DbFoodNutrients = {
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number | null;
  sodiumPer100g?: number | null;
  calciumPer100g?: number | null;
  ironPer100g?: number | null;
  magnesiumPer100g?: number | null;
  potassiumPer100g?: number | null;
  zincPer100g?: number | null;
  vitaminCPer100g?: number | null;
  vitaminDPer100g?: number | null;
  vitaminB12Per100g?: number | null;
};

function toFoodNutrients(food: DbFoodNutrients): FoodNutrients {
  return {
    name: food.name,
    kcalPer100g: food.kcalPer100g,
    proteinPer100g: food.proteinPer100g,
    carbsPer100g: food.carbsPer100g,
    fatPer100g: food.fatPer100g,
    fiberPer100g: food.fiberPer100g ?? 0,
    sodiumPer100g: food.sodiumPer100g ?? 0,
    calciumPer100g: food.calciumPer100g ?? 0,
    ironPer100g: food.ironPer100g ?? 0,
    magnesiumPer100g: food.magnesiumPer100g ?? 0,
    potassiumPer100g: food.potassiumPer100g ?? 0,
    zincPer100g: food.zincPer100g ?? 0,
    vitaminCPer100g: food.vitaminCPer100g ?? 0,
    vitaminDPer100g: food.vitaminDPer100g ?? 0,
    vitaminB12Per100g: food.vitaminB12Per100g ?? 0,
  };
}

function averageNutrition(days: ReturnType<typeof sumNutrients>[]) {
  if (!days.length) return sumNutrients([]);
  const totals = days.reduce((acc, day) => ({
    kcal: acc.kcal + day.kcal,
    proteinG: acc.proteinG + day.proteinG,
    carbsG: acc.carbsG + day.carbsG,
    fatG: acc.fatG + day.fatG,
    fiberG: acc.fiberG + day.fiberG,
    sodiumMg: acc.sodiumMg + day.sodiumMg,
    calciumMg: acc.calciumMg + day.calciumMg,
    ironMg: acc.ironMg + day.ironMg,
    magnesiumMg: acc.magnesiumMg + day.magnesiumMg,
    potassiumMg: acc.potassiumMg + day.potassiumMg,
    zincMg: acc.zincMg + day.zincMg,
    vitaminCMg: acc.vitaminCMg + day.vitaminCMg,
    vitaminDMcg: acc.vitaminDMcg + day.vitaminDMcg,
    vitaminB12Mcg: acc.vitaminB12Mcg + day.vitaminB12Mcg,
  }), sumNutrients([]));

  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Number((value / days.length).toFixed(1))])) as ReturnType<typeof sumNutrients>;
}

function proteinHitRate(days: Array<{ totals: ReturnType<typeof sumNutrients> }>, targetProteinG: number) {
  if (!days.length || !targetProteinG) return null;
  return days.filter((day) => day.totals.proteinG >= targetProteinG * 0.9).length / days.length;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function groupWaterByDay(logs: Array<{ date: Date; amountMl: number }>) {
  return logs.reduce((days, log) => {
    const key = log.date.toISOString().slice(0, 10);
    days.set(key, (days.get(key) ?? 0) + log.amountMl);
    return days;
  }, new Map<string, number>());
}

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function formatNullable(value: number | null | undefined, unit: string) {
  return typeof value === "number" ? `${formatNumber(value)} ${unit}` : "-";
}

function goalLabel(value: string) {
  const labels: Record<string, string> = { FAT_LOSS: "Perda de gordura", MAINTENANCE: "Manutencao", MUSCLE_GAIN: "Ganho de massa" };
  return labels[value] ?? value;
}

function experienceLabel(value: string) {
  const labels: Record<string, string> = { BEGINNER: "Iniciante", INTERMEDIATE: "Intermediario", ADVANCED: "Avancado" };
  return labels[value] ?? value;
}

function confidenceLabel(value: string) {
  const labels: Record<string, string> = { HIGH: "alta", MEDIUM: "media", LOW: "baixa" };
  return labels[value] ?? value;
}
