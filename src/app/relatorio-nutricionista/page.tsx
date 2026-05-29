import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buildBodyCompositionProjection } from "@/lib/bodyCompositionEngine";
import { sumNutrients, type FoodNutrients } from "@/lib/nutrition";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics, requireUserProfile } from "@/lib/profile";
import { effectiveTdee, validateTdeeTrend } from "@/lib/tdee";
import { PrintReportButton } from "./print-button";

export default async function NutritionistReportPage() {
  const { user, profile } = await requireUserProfile();
  const metrics = computeProfileMetrics(profile);
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [bodySnapshots, checkins, foodLogs, activePlan, activities, waterLogs, healthSummaries, supplementPlans] = await Promise.all([
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

  const latestBody = bodySnapshots[0];
  const recentFoodTotals = foodLogs.map((log) => ({
    date: log.date,
    totals: sumNutrients(log.items.map((item) => ({ food: toFoodNutrients(item.food), grams: item.grams }))),
  }));
  const averageIntake = averageNutrition(recentFoodTotals.map((day) => day.totals));
  const planTotals = activePlan ? sumNutrients(activePlan.meals.flatMap((meal) => meal.items.map((item) => ({ food: toFoodNutrients(item.food), grams: item.grams })))) : null;
  const tdeeResult = effectiveTdee({
    bmr: metrics.bmr,
    activityFactor: profile.activityFactor,
    adjustmentKcal: profile.tdeeAdjustmentKcal,
    mode: profile.tdeeCalculationMode,
    activities,
  });
  const tdeeValidation = validateTdeeTrend({
    tdee: metrics.tdee,
    averageIntakeKcal: Math.round(averageIntake.kcal),
    checkins: [...checkins].reverse(),
  });
  const bodyComposition = buildBodyCompositionProjection({
    currentWeightKg: profile.weightKg,
    currentWaistCm: profile.waistCm,
    currentBodyFatPct: latestBody?.bodyFatPct ?? metrics.bodyFat.percentage,
    targetBodyFatPct: profile.targetBodyFatPct,
    targetWaistCm: profile.targetWaistCm,
    targetDate: profile.targetDate,
    checkins: [...checkins].reverse(),
    snapshots: bodySnapshots,
    proteinHitRate: proteinHitRate(recentFoodTotals, metrics.targets.proteinG),
    deficitPct: metrics.tdee ? Math.round(((metrics.tdee - metrics.targets.calories) / metrics.tdee) * 100) : null,
  });
  const waterAverageMl = average(waterLogs.map((log) => log.amountMl));
  const activitiesTotals = {
    raw: Math.round(activities.reduce((sum, item) => sum + item.caloriesKcal, 0)),
    conservative: Math.round(activities.reduce((sum, item) => sum + (item.conservativeCaloriesKcal ?? item.caloriesKcal), 0)),
  };

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-5xl rounded-[28px] bg-white p-6 shadow-2xl shadow-black/10 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
            <ArrowLeft size={16} />
            Voltar
          </Link>
          <PrintReportButton />
        </div>

        <header className="border-b border-zinc-300 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">ShapeOS - relatório técnico para nutricionista</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{user.name}</h1>
              <p className="mt-1 text-sm text-zinc-600">{user.email}</p>
            </div>
            <div className="text-right text-sm text-zinc-600">
              <p>Emitido em {formatDate(new Date())}</p>
              <p>Período alimentar: últimos 30 dias</p>
            </div>
          </div>
          <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            Documento informativo gerado a partir de registros do usuário. Não substitui consulta, diagnóstico ou prescrição profissional.
          </p>
        </header>

        <ReportSection title="1. Perfil e objetivos">
          <InfoGrid>
            <Info label="Sexo" value={profile.sex === "MALE" ? "Masculino" : "Feminino"} />
            <Info label="Idade" value={`${profile.age} anos`} />
            <Info label="Altura" value={`${formatNumber(profile.heightCm)} cm`} />
            <Info label="Peso atual" value={`${formatNumber(profile.weightKg)} kg`} />
            <Info label="Objetivo" value={goalLabel(profile.goal)} />
            <Info label="Experiência" value={experienceLabel(profile.experience)} />
            <Info label="Modo" value={profile.mode === "ADVANCED" ? "Avançado" : "Guiado"} />
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
          <p className="mt-3 text-xs leading-5 text-zinc-600">{tdeeValidation.message}</p>
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
            <Info label="Confiança corporal" value={bodyComposition.confidenceLabel} />
          </InfoGrid>
          <p className="mt-3 text-xs leading-5 text-zinc-600">{bodyComposition.recomposition.message}</p>
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

        <ReportSection title="4. Consumo alimentar recente">
          <InfoGrid>
            <Info label="Média kcal" value={`${Math.round(averageIntake.kcal)} kcal/dia`} />
            <Info label="Média proteína" value={`${formatNumber(averageIntake.proteinG)} g/dia`} />
            <Info label="Média carbo" value={`${formatNumber(averageIntake.carbsG)} g/dia`} />
            <Info label="Média gordura" value={`${formatNumber(averageIntake.fatG)} g/dia`} />
            <Info label="Média fibra" value={`${formatNumber(averageIntake.fiberG)} g/dia`} />
            <Info label="Média sódio" value={`${formatNumber(averageIntake.sodiumMg)} mg/dia`} />
          </InfoGrid>
          <Table
            columns={["Data", "Kcal", "Proteína", "Carbo", "Gordura", "Fibra", "Sódio"]}
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
                <Info label="Proteína alvo" value={`${formatNumber(activePlan.targetProteinG)} g`} />
                <Info label="Carbo alvo" value={`${formatNumber(activePlan.targetCarbsG)} g`} />
                <Info label="Gordura alvo" value={`${formatNumber(activePlan.targetFatG)} g`} />
                <Info label="Total calculado" value={planTotals ? `${Math.round(planTotals.kcal)} kcal` : "pendente"} />
              </InfoGrid>
              {activePlan.meals.map((meal) => (
                <div key={meal.id} className="mt-4 break-inside-avoid">
                  <h3 className="font-semibold">{meal.name}</h3>
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
          ) : <p className="text-sm text-zinc-600">Nenhum plano alimentar ativo.</p>}
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

        <ReportSection title="7. Atividade, hidratação e saúde integrada">
          <InfoGrid>
            <Info label="Atividades registradas" value={`${activities.length}`} />
            <Info label="Kcal atividade bruta" value={`${activitiesTotals.raw} kcal / 30 dias`} />
            <Info label="Kcal conservadora" value={`${activitiesTotals.conservative} kcal / 30 dias`} />
            <Info label="Água média registrada" value={`${Math.round(waterAverageMl)} ml/dia`} />
            <Info label="Dias Apple/Health" value={`${healthSummaries.length}`} />
          </InfoGrid>
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

        <ReportSection title="8. Suplementos monitorados">
          {supplementPlans.length ? (
            <Table
              columns={["Suplemento", "Protocolo", "Dose/dia", "Início", "Ativo", "Registros recentes"]}
              rows={supplementPlans.map((plan) => [
                plan.name,
                plan.protocol,
                `${formatNumber(plan.dailyDoseG)} g`,
                formatDate(plan.startedAt),
                plan.isActive ? "sim" : "não",
                plan.logs.map((log) => `${formatDate(log.date)} ${formatNumber(log.doseG)}g`).join("; "),
              ])}
            />
          ) : <p className="text-sm text-zinc-600">Nenhum suplemento registrado.</p>}
        </ReportSection>
      </div>
    </main>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 break-inside-avoid">
      <h2 className="border-b border-zinc-200 pb-2 text-lg font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">{children}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-800">{value}</p>
    </div>
  );
}

function Table({ columns, rows, compact = false }: { columns: string[]; rows: string[][]; compact?: boolean }) {
  if (!rows.length) return <p className="text-sm text-zinc-600">Sem dados registrados.</p>;

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className="border border-zinc-200 bg-zinc-100 px-2 py-2 font-semibold text-zinc-700">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className={`border border-zinc-200 px-2 align-top ${compact ? "py-1.5" : "py-2"}`}>{cell || "-"}</td>
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
  const labels: Record<string, string> = { FAT_LOSS: "Perda de gordura", MAINTENANCE: "Manutenção", MUSCLE_GAIN: "Ganho de massa" };
  return labels[value] ?? value;
}

function experienceLabel(value: string) {
  const labels: Record<string, string> = { BEGINNER: "Iniciante", INTERMEDIATE: "Intermediário", ADVANCED: "Avançado" };
  return labels[value] ?? value;
}

function confidenceLabel(value: string) {
  const labels: Record<string, string> = { HIGH: "alta", MEDIUM: "média", LOW: "baixa" };
  return labels[value] ?? value;
}
