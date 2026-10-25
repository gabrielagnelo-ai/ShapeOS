import { PageHeading } from "@/components/ui/page-heading";
import { Info, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { bodyStateFromLatestSnapshot, recalculateBodyCompositionSnapshots } from "@/lib/body-composition";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics, requireUserProfile } from "@/lib/profile";
import type { Sex } from "@/lib/nutrition";
import metricStrip from "@/components/ui/metric-strip.module.css";
import { Hero, Section, Stack } from "@/components/ui/screen";

const goalLabels = {
  fat_loss: "Perda de peso",
  maintenance: "Manutenção",
  muscle_gain: "Ganho de massa",
} as const;

export default async function CalculadorasPage() {
  const { user, profile } = await requireUserProfile();
  const sex = (profile.sex === "MALE" ? "male" : "female") as Sex;
  const rawBodySnapshots = await prisma.bodyCompositionSnapshot.findMany({
    where: { userId: user.id },
    orderBy: { measuredAt: "desc" },
    take: 1,
  });
  const bodySnapshots = recalculateBodyCompositionSnapshots(rawBodySnapshots, { sex, heightCm: profile.heightCm });
  const currentBody = bodyStateFromLatestSnapshot(profile, bodySnapshots);
  const metrics = computeProfileMetrics(profile, currentBody);
  const bodySource = rawBodySnapshots[0]?.source === "weekly_checkin" ? "último check-in" : "perfil atual";
  const goalDetail =
    metrics.goal === "fat_loss"
      ? `Déficit escolhido: ${profile.calorieDeficitKcal ?? 400} kcal`
      : metrics.goal === "muscle_gain"
        ? "Superávit padrão: 300 kcal"
        : "Meta igual ao gasto diário estimado";

  return (
    <AppShell>
      <PageHeading title="Cálculos do perfil" description="Confira as estimativas calculadas a partir das suas medidas atuais." />
      <Stack>
        <Hero aria-label="Meta diária">
          <p className="text-headline">Meta diária · {goalLabels[metrics.goal]}</p>
          <p className="mt-2 text-[40px] font-bold leading-[44px] tracking-[-0.03em] tabular-nums">{metrics.targets.calories.toLocaleString("pt-BR")} <span className="text-body font-normal tracking-normal text-text-muted">kcal por dia</span></p>
          <p className="mt-2 text-sm text-text-muted">{goalDetail} · <Link href="/configuracoes" className="font-semibold text-primary hover:text-primary-light">Ajustar metas</Link></p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MacroBox label="Proteína" value={`${metrics.targets.proteinG}g`} detail={`${metrics.targets.proteinG * 4} kcal`} />
            <MacroBox label="Carboidrato" value={`${metrics.targets.carbsG}g`} detail={`${metrics.targets.carbsG * 4} kcal`} />
            <MacroBox label="Gordura" value={`${metrics.targets.fatG}g`} detail={`${metrics.targets.fatG * 9} kcal`} />
          </div>
        </Hero>

        <Section title="Medidas do perfil">
          <div className={metricStrip.strip}>
            <div><small>Calorias em repouso</small><strong>{metrics.bmr.toLocaleString("pt-BR")} <span>kcal</span></strong><p className="mt-2 text-xs text-text-muted">Gasto estimado em repouso.</p></div>
            <div><small>Gasto diário estimado</small><strong>{metrics.tdee.toLocaleString("pt-BR")} <span>kcal</span></strong><p className="mt-2 text-xs text-text-muted">Fator de atividade {profile.activityFactor.toLocaleString("pt-BR")}.</p></div>
            <div><small>IMC</small><strong>{metrics.bmi.toLocaleString("pt-BR")}</strong><p className="mt-2 text-xs text-text-muted">{currentBody.weightKg.toLocaleString("pt-BR")} kg do {bodySource}.</p></div>
            <div><small>Gordura estimada</small><strong>{metrics.bodyFat.percentage == null ? "—" : `${metrics.bodyFat.percentage.toLocaleString("pt-BR")}%`}</strong><p className="mt-2 text-xs text-text-muted">Estimativa pelas medidas.</p></div>
          </div>
        </Section>

        <Section title="Entenda o cálculo" columns={2}>
          <GlassCard>
            <div className="flex items-start gap-4">
              <div className="icon-tile [--tile:#8e8e93]">
                <ShieldCheck size={21} />
              </div>
              <div>
                <h3 className="font-semibold">Como a meta é montada</h3>
                <p className="mt-3 text-sm leading-6 text-text-muted">
                  A meta diária vem do seu gasto estimado menos ou mais o ajuste escolhido. Proteína usa 4 kcal/g, gordura usa 9 kcal/g e carboidrato fica com as calorias restantes.
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 shrink-0 text-text-muted" size={20} />
              <div>
                <h3 className="font-semibold">Detalhe técnico</h3>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  BMR usa Mifflin-St Jeor. Gasto diário = BMR vezes fator de atividade. Gordura estimada usa o método da Marinha Americana quando cintura, pescoço e, para mulheres, quadril estão preenchidos.
                </p>
                <p className="mt-4 text-sm leading-6 text-text-muted">
                  A gordura corporal é uma estimativa e não substitui avaliação profissional, bioimpedância ou dobras cutâneas.
                </p>
              </div>
            </div>
          </GlassCard>
        </Section>
      </Stack>
    </AppShell>
  );
}

function MacroBox({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[14px] bg-surface-tertiary p-4">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
      <p className="mt-1 text-xs text-text-muted">{detail}</p>
    </div>
  );
}
