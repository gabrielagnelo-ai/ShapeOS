import { BodyGoal } from "@/components/body/body-goal";
import { ArrowRight, BarChart3, Sparkles } from "lucide-react";
import { BodyProgress } from "@/components/body/body-progress";
import { AppShell } from "@/components/shell/app-shell";
import { EnergyCard, NutritionHero, SleepCard, TodayMeals, TrainingCard, WaterCard } from "@/components/today/today-cards";
import { GlassCard } from "@/components/ui/glass-card";
import { IconTile } from "@/components/ui/group";
import { PageHeading } from "@/components/ui/page-heading";
import { Section, Stack } from "@/components/ui/screen";
import styles from "./today.module.css";
import { SubmitButton } from "@/components/ui/submit-button";
import { ProgressChart } from "@/components/ui/progress-chart";
import { WaterReminder } from "@/components/water/water-reminder";
import { loadToday, type TodayNextStep, type TodayView } from "@/lib/data/today";
import { requireUserProfile } from "@/lib/profile";
import { waterPreferenceLabel } from "@/lib/water";
import { addWaterLogAction } from "./actions";

export default async function DashboardPage() {
  const { user, profile } = await requireUserProfile();
  const {
    sex, currentBody, bodyTimeline, targets, consumed, hasLoggedToday, remainingCalories, remainingProtein,
    water, insights, bodyComposition, nextStep, greeting, dateLabel, todayMeals, nextTraining, week,
    trainingPerformance, sleep, energy, weeklyCheckins, lastCheckin,
  } = await loadToday(user, profile);
  const nextAction = nextStepCopy(nextStep);

  return (
    <AppShell dashboard>
      <PageHeading title={greeting} description={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} />
      <Stack>
        {/* First screen, as in the preferred reference: nutrition and food beside the body model. */}
        <div className={styles.top}>
          <div className={styles.hero}>
            <NutritionHero
              lead={hasLoggedToday
                ? remainingCalories > 0
                  ? <>Faltam {remainingCalories} kcal e {remainingProtein} g de proteína para fechar o dia.</>
                  : "Você atingiu a meta de calorias de hoje."
                : "Registre sua primeira refeição para acompanhar as metas de hoje."}
              macros={[
                { label: "Calorias", color: "#f5f5f7", consumed: consumed.kcal, target: targets.calories, unit: "kcal" },
                { label: "Proteínas", color: "#7dd3fc", consumed: Math.round(consumed.proteinG), target: targets.proteinG, unit: "g" },
                { label: "Carboidratos", color: "#b8ff00", consumed: Math.round(consumed.carbsG), target: targets.carbsG, unit: "g" },
                { label: "Gorduras", color: "#fbbf24", consumed: Math.round(consumed.fatG), target: targets.fatG, unit: "g" },
              ]}
              action={
                // Próximo passo: the one filled action of the page, with the reason to do it.
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-headline">{nextAction.title}</p>
                    {nextAction.text ? <p className="mt-0.5 max-w-2xl text-body-sm text-text-muted">{nextAction.text}</p> : null}
                  </div>
                  <a href={nextAction.href} className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-primary px-5 py-2.5 text-body font-semibold text-primary-foreground hover:bg-primary-light sm:self-center">
                    {nextAction.cta}
                    <ArrowRight size={16} aria-hidden="true" />
                  </a>
                </div>
              }
            />
          </div>
          <div className={styles.body}>
            <BodyProgress sex={sex} heightCm={profile.heightCm} timeline={bodyTimeline} className="" goal={
              <BodyGoal projection={bodyComposition} waist={currentBody.waistCm ?? null} targetWaist={profile.targetWaistCm} weight={currentBody.weightKg} />
            } />
          </div>
          <div className={styles.food}>
            <Section title="Alimentação" link={{ href: "/diario", label: "Abrir diário" }} columns={2}>
              <TodayMeals meals={todayMeals} />
              <WaterCard
                consumedMl={water.consumedMl}
                targetMl={water.targetMl}
                detail={`Perfil de hidratação: ${waterPreferenceLabel(profile.waterPreference).toLowerCase()}.`}
                stats={[
                  { label: "Mês", value: formatLiters(water.month.averageMl), detail: `${water.month.registeredDays} dias` },
                  { label: "Trimestre", value: formatLiters(water.quarter.averageMl), detail: `${water.quarter.registeredDays} dias` },
                  { label: "Semestre", value: formatLiters(water.semester.averageMl), detail: `${water.semester.registeredDays} dias` },
                ]}
                actions={
                  <>
                    {[500, 1000].map((amount) => (
                      <form key={amount} action={addWaterLogAction}>
                        <input type="hidden" name="amountMl" value={amount} />
                        <SubmitButton pendingLabel="Registrando…" className="min-h-10 rounded-full bg-fill px-4 py-2 text-body-sm font-semibold text-text-primary hover:bg-fill-strong">
                          {amount === 1000 ? "+1 L" : "+500 ml"}
                        </SubmitButton>
                      </form>
                    ))}
                    <WaterReminder />
                  </>
                }
              />
            </Section>
          </div>
        </div>

        <Section title="Evolução" link={{ href: "/acompanhamento", label: "Ver progresso" }} columns={2}>
          <GlassCard>
            <div className="mb-5 flex items-center gap-3">
              <IconTile icon={BarChart3} colour="blue" />
              <div>
                <h3 className="text-h4">Peso médio semanal</h3>
                <p className="text-body-sm text-text-muted">{weeklyCheckins.length} {weeklyCheckins.length === 1 ? "check-in" : "check-ins"}</p>
              </div>
            </div>
            <ProgressChart
              points={weeklyCheckins.map((checkin) => ({
                label: checkin.weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
                value: checkin.averageWeightKg,
              }))}
            />
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-3">
              <IconTile icon={Sparkles} colour="brand" />
              <div>
                <h3 className="text-h4">Coach</h3>
                <p className="text-body-sm text-text-muted">{insights.length ? `${insights.length} ${insights.length === 1 ? "sinal ativo" : "sinais ativos"}` : "Sem alertas"}</p>
              </div>
            </div>
            {insights.length ? (
              <ul className="-mx-5 mt-3 md:-mx-6">
                {insights.slice(0, 3).map((insight) => (
                  <li key={insight.trigger} className="border-b border-hairline last:border-b-0">
                    <a href="/coach" className="flex items-start gap-3 px-5 py-3 hover:bg-surface-hover md:px-6">
                      <span className="min-w-0 flex-1">
                        <span className="block text-body-sm font-semibold text-text-secondary">{coachCategoryLabel(insight.category)}</span>
                        <span className="mt-0.5 block text-body text-text-primary">{insight.message}</span>
                      </span>
                      <ArrowRight size={16} aria-hidden="true" className="mt-1 shrink-0 text-text-muted" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-body-sm text-text-muted">O Coach aplica regras fixas aos seus registros de alimentação, sono, treino e medidas. Continue registrando para receber as primeiras sugestões.</p>}
          </GlassCard>
        </Section>

        <Section title="Treino e recuperação" link={{ href: "/treinos", label: "Abrir treinos" }} columns={3}>
          <TrainingCard
            next={nextTraining}
            week={week}
            performance={{ value: trainingPerformance.trend === "insufficient" ? "Em formação" : `${trainingPerformance.score}`, detail: trainingDashboardDetail(trainingPerformance) }}
          />
          <SleepCard sleep={sleep} checkinSleep={lastCheckin?.sleep ?? null} />
          <EnergyCard energy={energy} checkinEnergy={lastCheckin?.energy ?? null} />
        </Section>
      </Stack>
    </AppShell>
  );
}

const NEXT_STEP_COPY: Record<TodayNextStep["kind"], { href: string; title: string; text: string; cta: string }> = {
  "create-plan": { href: "/dieta", title: "Gerar plano alimentar", text: "Monte seu plano inicial ou registre a dieta do nutricionista.", cta: "Abrir dieta" },
  "log-meal": { href: "/diario", title: "Registrar primeira refeição", text: "Registre o que você comeu hoje para comparar com a meta.", cta: "Registrar alimento" },
  checkin: { href: "/acompanhamento", title: "Fazer check-in semanal", text: "Peso, cintura, sono e treino melhoram as projeções do Coach.", cta: "Fazer check-in" },
  coach: { href: "/coach", title: "Ver recomendação do Coach", text: "", cta: "Abrir Coach" },
  "keep-going": { href: "/diario", title: "Manter consistência", text: "Continue registrando refeições para manter o acompanhamento confiável.", cta: "Registrar hoje" },
};

function nextStepCopy(step: TodayNextStep) {
  const copy = NEXT_STEP_COPY[step.kind];
  return step.kind === "coach" ? { ...copy, text: step.message } : copy;
}

function formatLiters(valueMl: number) {
  return `${(valueMl / 1000).toFixed(1).replace(".", ",")} L`;
}

function coachCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    nutrition: "Nutrição",
    weight: "Peso",
    sleep: "Sono",
    adherence: "Aderência",
    training: "Treino",
  };

  return labels[category] ?? category;
}

function trainingDashboardDetail(performance: TodayView["trainingPerformance"]) {
  if (performance.trend === "improving") return `${exercises(performance.improvedExercises)} em progressão`;
  if (performance.trend === "declining") return `${exercises(performance.declinedExercises)} em queda`;
  if (performance.trend === "stable") return `${exercises(performance.comparableExercises)} comparados`;
  return "registre carga e repetições";
}

function exercises(count: number) {
  return `${count} ${count === 1 ? "exercício" : "exercícios"}`;
}
