import { PageHeading } from "@/components/ui/page-heading";
import { redirect } from "next/navigation";
import { CalendarDays, Gauge, HeartPulse, Ruler, Save, SlidersHorizontal, Utensils } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { DeficitAdvisor } from "@/components/onboarding/deficit-advisor";
import { getCurrentUser } from "@/lib/auth";
import { bodyStateFromLatestSnapshot, recalculateBodyCompositionSnapshots } from "@/lib/body-composition";
import { CIRCUMFERENCE_FIELDS } from "@/lib/body-measurements";
import { buildBodyCompositionProjection } from "@/lib/bodyCompositionEngine";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics } from "@/lib/profile";
import { waterPreferenceLabel, waterTargetMl } from "@/lib/water";
import { updateGoalsAction } from "./actions";
import { confidenceLabel } from "@/lib/common";
import styles from "./settings.module.css";
import metricStrip from "@/components/ui/metric-strip.module.css";
import { Stack } from "@/components/ui/screen";

const inputClass = "mt-2 h-12 w-full rounded-[14px] bg-fill px-4 outline-none transition";

const goalLabels = {
  fat_loss: "Perda de peso",
  maintenance: "Manutenção",
  muscle_gain: "Ganho de massa",
} as const;

export default async function ConfiguracoesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?erro=Sessão não encontrada. Entre novamente.");

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

  let metrics = computeProfileMetrics(profile);
  const calorieDeficit = profile.calorieDeficitKcal ?? 400;
  const deficitPct = metrics.tdee ? Math.round((calorieDeficit / metrics.tdee) * 100) : 0;
  const macroCalories = metrics.targets.proteinG * 4 + metrics.targets.fatG * 9 + metrics.targets.carbsG * 4;
  const checkins = (await prisma.weeklyCheckin.findMany({ where: { userId: user.id }, orderBy: { weekStart: "desc" }, take: 8 })).reverse();
  const rawBodySnapshots = await prisma.bodyCompositionSnapshot.findMany({ where: { userId: user.id }, orderBy: { measuredAt: "desc" }, take: 12 });
  const bodySnapshots = recalculateBodyCompositionSnapshots(rawBodySnapshots, { sex: metrics.sex, heightCm: profile.heightCm });
  const currentBody = bodyStateFromLatestSnapshot(profile, bodySnapshots);
  metrics = computeProfileMetrics(profile, currentBody);
  const waterTarget = waterTargetMl(currentBody.weightKg, profile.waterPreference);
  const bodyComposition = buildBodyCompositionProjection({
    currentWeightKg: currentBody.weightKg,
    currentWaistCm: currentBody.waistCm,
    currentBodyFatPct: bodySnapshots[0]?.bodyFatPct ?? metrics.bodyFat.percentage,
    targetWaistCm: profile.targetWaistCm,
    targetBodyFatPct: profile.targetBodyFatPct,
    targetDate: profile.targetDate,
    checkins,
    snapshots: bodySnapshots,
    deficitPct,
  });

  return (
    <AppShell>
      <PageHeading title="Perfil e metas" description="Ajuste suas medidas, preferências e metas de alimentação."><span>{goalLabels[metrics.goal]}</span></PageHeading>
      <Stack>
      <div className={metricStrip.strip}><div><small>Meta diária</small><strong>{metrics.targets.calories} <span>kcal</span></strong></div><div><small>Proteína</small><strong>{metrics.targets.proteinG} <span>g</span></strong></div><div><small>Carboidrato</small><strong>{metrics.targets.carbsG} <span>g</span></strong></div><div><small>Gordura</small><strong>{metrics.targets.fatG} <span>g</span></strong></div></div>

      <form action={updateGoalsAction} className={styles.form}>
        <div className="grid gap-5">
          <SectionCard
            icon={<Gauge size={20} />}
            title="Gasto e déficit"
            text="Escolha como estimar o gasto diário e o ajuste de calorias para sua meta."
          >
            <div className="grid gap-4 grid-cols-1">
              <Field label="Cálculo do gasto diário" help="TDEE é a estimativa do gasto total de energia. Escolha se as atividades já fazem parte da rotina ou serão somadas ao registrá-las.">
                <select name="tdeeCalculationMode" defaultValue={profile.tdeeCalculationMode} className={inputClass}>
                  <option value="COEFFICIENT">Rotina incluída no fator de atividade</option>
                  <option value="ADDITIVE">Somar as atividades registradas</option>
                </select>
              </Field>
              <Field label="Fator de atividade" help="Use algo entre 1,1 e 2,2. Exemplo: 1,45 para rotina ativa, mas conservadora.">
                <input name="activityFactor" defaultValue={formatInput(profile.activityFactor)} inputMode="decimal" className={inputClass} />
              </Field>
              <Field label="Déficit calórico" help="O aviso abaixo considera o tamanho do déficit e o risco de fome, queda de treino e perda de massa magra.">
                <DeficitAdvisor name="calorieDeficitKcal" className={inputClass} defaultValue={calorieDeficit} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            icon={<Utensils size={20} />}
            title="Nutrientes da meta"
            text="Proteína e gordura são calculadas por kg. Os carboidratos completam a meta diária de calorias."
          >
            <div className="grid gap-4 grid-cols-1">
              <Field label="Proteína por kg" help="Faixa aceita: 1,2 a 3,0 g/kg. Proteína usa 4 kcal por grama.">
                <input name="proteinPerKg" defaultValue={formatInput(profile.proteinPerKg ?? 1.8)} inputMode="decimal" className={inputClass} />
              </Field>
              <Field label="Gordura por kg" help="Faixa aceita: 0,4 a 1,5 g/kg. Gordura usa 9 kcal por grama.">
                <input name="fatPerKg" defaultValue={formatInput(profile.fatPerKg ?? 0.8)} inputMode="decimal" className={inputClass} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            icon={<Ruler size={20} />}
            title="Medidas corporais"
            text="Pescoço, cintura e quadril são usados para estimar a gordura corporal pelo método da Marinha Americana. As demais medidas ajustam o modelo corporal."
          >
            <div className="grid gap-4 grid-cols-1">
              <Field label="Peso atual em kg" help="Atualize sempre que houver mudança relevante.">
                <input name="weightKg" defaultValue={formatInput(profile.weightKg)} inputMode="decimal" className={inputClass} />
              </Field>
              <Field label="Pescoço em cm">
                <input name="neckCm" defaultValue={profile.neckCm ? formatInput(profile.neckCm) : ""} inputMode="decimal" className={inputClass} />
              </Field>
              <Field label="Cintura em cm">
                <input name="waistCm" defaultValue={profile.waistCm ? formatInput(profile.waistCm) : ""} inputMode="decimal" className={inputClass} />
              </Field>
              {profile.sex === "FEMALE" ? (
                <Field label="Quadril em cm" help="Obrigatório para estimar a gordura corporal feminina pelo método da Marinha.">
                  <input name="hipCm" defaultValue={profile.hipCm ? formatInput(profile.hipCm) : ""} inputMode="decimal" className={inputClass} required />
                </Field>
              ) : (
                <Field label="Quadril em cm" help="Opcional para homens. Usado só no modelo corporal.">
                  <input name="hipCm" defaultValue={profile.hipCm ? formatInput(profile.hipCm) : ""} inputMode="decimal" className={inputClass} />
                </Field>
              )}
              {CIRCUMFERENCE_FIELDS.map((field) => (
                <Field key={field.key} label={`${field.label[metrics.sex]} em cm`} help={`Opcional. ${field.help}`}>
                  <input name={field.key} defaultValue={profile[field.key] ? formatInput(profile[field.key]!) : ""} inputMode="decimal" className={inputClass} placeholder={field.placeholder} />
                </Field>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            icon={<CalendarDays size={20} />}
            id="meta-corporal" title="Composição corporal"
            text="Defina a gordura corporal e a cintura que deseja acompanhar como meta. O peso projetado é calculado a partir da massa magra estimada."
          >
            <div className="grid gap-4 grid-cols-1">
              <Field label="Gordura corporal alvo (%)" help="Ex.: 15 para calcular a projeção com 15% de gordura e a massa magra atual.">
                <input name="targetBodyFatPct" defaultValue={profile.targetBodyFatPct ? formatInput(profile.targetBodyFatPct) : ""} inputMode="decimal" className={inputClass} />
              </Field>
              <Field label="Cintura alvo em cm" help="Métrica principal para validar recomposição e perda de gordura.">
                <input name="targetWaistCm" defaultValue={profile.targetWaistCm ? formatInput(profile.targetWaistCm) : ""} inputMode="decimal" className={inputClass} />
              </Field>
              <Field label="Data desejada" help="Opcional. Serve para comparar se o ritmo atual está coerente.">
                <input name="targetDate" type="date" defaultValue={profile.targetDate ? dateInputValue(profile.targetDate) : ""} className={inputClass} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            icon={<SlidersHorizontal size={20} />}
            title="Preferências de alimentação"
            text="Essas preferências ficam no seu perfil. A hidratação ajusta a meta diária de água."
          >
            <div className="grid gap-4 grid-cols-1">
              <Field label="Estilo alimentar">
                <select name="dietPreference" defaultValue={profile.dietPreference ?? "balanced"} className={inputClass}>
                  <option value="balanced">Equilibrado - saciedade e prazer</option>
                  <option value="satiety">Mais saciedade - volume, fibra e proteína</option>
                  <option value="pleasure">Mais prazer - encaixar alimentos gostosos com controle</option>
                  <option value="low_meal_volume">Comer menos volume - refeições menores e densas</option>
                  <option value="simple_repetitive">Simples e repetitivo - praticidade máxima</option>
                </select>
              </Field>
              <Field label="Meta de água" help={`Meta atual estimada: ${formatLiters(waterTarget)} por dia.`}>
                <select name="waterPreference" defaultValue={profile.waterPreference ?? "medium"} className={inputClass}>
                  <option value="minimum">Mínimo - 30 ml/kg</option>
                  <option value="medium">Médio - 35 ml/kg</option>
                  <option value="high">Elevado - 45 ml/kg</option>
                </select>
              </Field>
            </div>
          </SectionCard>
        </div>

        <aside className="grid gap-5 xl:sticky xl:top-28">
          <button className="group relative inline-flex min-h-12 items-center justify-center gap-2 overflow-hidden rounded-full bg-primary text-primary-foreground hover:bg-primary-light px-6 font-semibold">

            <Save size={18} />
            Salvar e recalcular
          </button>
          <GlassCard className="metabolic-summary">
            <div className="border-b border-hairline pb-4">
              <h3>Impacto atual</h3>
              <h2 className="mt-2 text-2xl font-semibold">Resumo metabólico</h2>
            </div>
            <div className="grid">
              <SummaryLine label="Repouso" value={`${metrics.bmr} kcal`} detail="BMR estimado" />
              <SummaryLine label="Gasto diário" value={`${metrics.tdee} kcal`} detail={`${profile.tdeeCalculationMode === "ADDITIVE" ? "modo aditivo" : "modo coeficiente"} / fator ${formatInput(profile.activityFactor)}`} />
              <SummaryLine label="Confiança do gasto diário" value={confidenceLabel(profile.tdeeConfidence)} detail={profile.tdeeAdjustmentKcal ? `ajuste ${profile.tdeeAdjustmentKcal} kcal` : "sem ajuste adaptativo"} />
              <SummaryLine label="Déficit" value={`${calorieDeficit} kcal`} detail={`${deficitPct}% do gasto`} tone={deficitPct >= 25 ? "danger" : deficitPct >= 18 ? "warning" : "good"} />
              <SummaryLine label="Macros" value={`${macroCalories} kcal`} detail="P 4 / C 4 / G 9 kcal por g" />
              <SummaryLine label="Água" value={formatLiters(waterTarget)} detail={`consumo ${waterPreferenceLabel(profile.waterPreference).toLowerCase()}`} />
              <SummaryLine label="Gordura corporal estimada" value={metrics.bodyFat.percentage == null ? "—" : `${metrics.bodyFat.percentage}%`} detail="método da Marinha" />
              <SummaryLine label="Massa magra" value={bodyComposition.currentLeanMassKg ? `${formatInput(bodyComposition.currentLeanMassKg)} kg` : "—"} detail={bodyComposition.muscleSignal.label} />
              <SummaryLine label="Massa gorda atual" value={bodyComposition.currentFatMassKg ? `${formatInput(bodyComposition.currentFatMassKg)} kg` : "—"} detail={bodyComposition.fatMassToLoseKg ? `${formatInput(bodyComposition.fatMassToLoseKg)} kg a perder` : "defina a gordura corporal alvo"} />
              <SummaryLine label="Massa gorda alvo" value={bodyComposition.targetFatMassKg ? `${formatInput(bodyComposition.targetFatMassKg)} kg` : "—"} detail="calculada pela gordura corporal alvo" />
              <SummaryLine label="Faixa provável" value={bodyComposition.probableWeightRangeKg ? `${formatInput(bodyComposition.probableWeightRangeKg.minKg)}-${formatInput(bodyComposition.probableWeightRangeKg.maxKg)} kg` : "—"} detail="água, glicogênio e retenção" />
              <SummaryLine label="Confiança corporal" value={confidenceLabel(bodyComposition.confidenceLabel)} detail="Baseada na quantidade de check-ins" tooltip="A confiança aumenta conforme mais check-ins corporais são registrados." />
              <SummaryLine label="Cenário realista" value={scenarioDate(bodyComposition)} detail={bodyComposition.primaryMessage} />
            </div>
          </GlassCard>

          <GlassCard className={styles.safety}>
            <div className="flex items-start gap-3">
              <div className="icon-tile [--tile:#0a84ff]">
                <HeartPulse size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Regra de segurança</h2>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  Déficit alto pode funcionar por um tempo, mas aumenta risco de fome, piora no treino e perda de massa magra. Revise pelo Coach semanalmente.
                </p>
              </div>
            </div>
          </GlassCard>


        </aside>
      </form>
      </Stack>
    </AppShell>
  );
}

function SectionCard({ id, icon, title, text, children }: { id?: string; icon: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  return (
    <section id={id} className={`${styles.section} scroll-mt-28`}>
      <div className={styles.sectionHeading}>
        <div className="icon-tile [--tile:#8e8e93]">{icon}</div>
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">{text}</p>
        </div>
      </div>
      <div className={styles.sectionFields}>{children}</div>
    </section>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      {children}
      {help ? <p className="mt-2 text-xs leading-5 text-text-muted">{help}</p> : null}
    </label>
  );
}

function SummaryLine({
  label,
  value,
  detail,
  tone = "neutral",
  tooltip,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "good" | "warning" | "danger";
  tooltip?: string;
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-400/20 bg-danger/15 text-danger"
      : tone === "warning"
        ? "bg-warning/10 text-warning"
        : tone === "good"
          ? "bg-success/10 text-success"
          : "bg-surface-tertiary text-text-primary";

  return (
    <div className={`${styles.summaryLine} ${toneClass}`} title={tooltip}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-muted">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
      <p className="mt-1 text-xs text-text-muted">{detail}</p>
    </div>
  );
}

function formatInput(value: number) {
  return String(value).replace(".", ",");
}

function formatLiters(valueMl: number) {
  return `${(valueMl / 1000).toFixed(1).replace(".", ",")} L`;
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function scenarioDate(composition: ReturnType<typeof buildBodyCompositionProjection>) {
  const realistic = composition.scenarios.find((scenario) => scenario.key === "realistic");
  return realistic?.estimatedDate ? realistic.estimatedDate.toLocaleDateString("pt-BR") : "—";
}
