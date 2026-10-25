import { PageHeading } from "@/components/ui/page-heading";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import { BodyProgress } from "@/components/body/body-progress";
import { AppShell } from "@/components/shell/app-shell";
import { bodyStateFromLatestSnapshot, recalculateBodyCompositionSnapshots } from "@/lib/body-composition";
import { CheckinWizard } from "@/components/body/checkin-wizard";
import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import { buildBodyTimeline } from "@/lib/body-progress";
import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/profile";
import { suggestCalorieAdjustment, type Goal } from "@/lib/nutrition";
import { deleteBodyPhotoAction, deleteWeeklyCheckinAction, saveWeeklyCheckinAction } from "./actions";
import { BodyPhotoUploader } from "./body-photo-uploader";
import styles from "./progress.module.css";
import buttons from "@/components/ui/buttons.module.css";
import sections from "@/components/ui/sections.module.css";

const goalMap = { FAT_LOSS: "fat_loss", MAINTENANCE: "maintenance", MUSCLE_GAIN: "muscle_gain" } as const;


export default async function AcompanhamentoPage() {
  const { user, profile } = await requireUserProfile();
  const checkins = await prisma.weeklyCheckin.findMany({
    where: { userId: user.id },
    include: { bodyPhotos: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } },
    orderBy: { weekStart: "desc" },
    take: 8,
  });
  const rawBodySnapshots = await prisma.bodyCompositionSnapshot.findMany({
    where: { userId: user.id },
    orderBy: { measuredAt: "desc" },
    take: 30, // ~7 meses de check-ins semanais: cobre a comparação de 90 dias
  });
  const bodySnapshots = recalculateBodyCompositionSnapshots(rawBodySnapshots, {
    sex: profile.sex === "MALE" ? "male" : "female",
    heightCm: profile.heightCm,
  });
  const currentBody = bodyStateFromLatestSnapshot(profile, bodySnapshots);
  const sex = profile.sex === "MALE" ? "male" : "female";
  const bodyTimeline = buildBodyTimeline(profile, bodySnapshots);
  const latest = checkins[0];
  const adjustment = suggestCalorieAdjustment({
    goal: goalMap[profile.goal] as Goal,
    currentCalories: profile.targetCalories ?? 0,
    weeks: [...checkins].reverse().map((checkin) => ({
      averageWeightKg: checkin.averageWeightKg,
      adherencePct: checkin.adherencePct,
      hunger: checkin.hunger,
      energy: checkin.energy,
      sleep: checkin.sleep,
    })),
  });

  const overview = <div className={styles.overview}>
    <BodyProgress sex={sex} heightCm={profile.heightCm} timeline={bodyTimeline} className={styles.model} />
    <aside className={styles.summary}>
      <section className={sections.section}>
        <div className={sections.heading}><h2>Sua semana</h2><span>{latest ? latest.weekStart.toLocaleDateString("pt-BR") : "Primeiro registro"}</span></div>
        {latest ? <dl className={styles.wellbeing}>{[
          ["Adesão à dieta", `${latest.adherencePct}%`], ["Fome", `${latest.hunger}/10`],
          ["Energia", `${latest.energy}/10`], ["Sono", `${latest.sleep}/10`],
        ].map(([label, number]) => <div key={label}><dt>{label}</dt><dd>{number}</dd></div>)}</dl>
        : <p className={sections.empty}>Registre suas medidas e como você se sentiu para começar a acompanhar a evolução.</p>}
        <a className={`${buttons.primary} ${styles.summaryAction}`} href="#novo-checkin">{latest ? "Fazer novo check-in" : "Começar meu check-in"} <span aria-hidden="true">→</span></a>
      </section>
      <section className={`${sections.section} ${styles.insight}`}><h2>Ajuste da semana</h2><p>{adjustment.reason}</p>{adjustment.delta !== 0 && <strong>{adjustment.delta > 0 ? "+" : ""}{adjustment.delta}<span> kcal</span></strong>}<a href="#historico">Ver registros anteriores <span aria-hidden="true">↗</span></a></section>
    </aside>
  </div>;
  const history = <section className={`${sections.section} ${styles.history}`}><div className={sections.heading}><h2>Histórico de check-ins</h2><span>{checkins.length} registros recentes</span></div><div className={styles.historyList}>
            {checkins.map((checkin) => (
              <div key={checkin.id} className="rounded-[14px] bg-surface-tertiary p-4 text-sm text-text-secondary">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-text-primary">{checkin.weekStart.toLocaleDateString("pt-BR")}</p>
                    <p className="mt-1 tabular-nums text-text-muted">{checkin.averageWeightKg} kg · adesão {checkin.adherencePct}% · {checkin.bodyPhotos.length}/8 fotos</p>
                  </div>
                  <form action={deleteWeeklyCheckinAction}>
                    <input type="hidden" name="checkinId" value={checkin.id} />
                    <button className="grid size-10 place-items-center rounded-full bg-fill text-text-secondary hover:bg-danger/15 hover:text-danger" aria-label="Excluir check-in">
                      <Trash2 size={15} />
                    </button>
                  </form>
                </div>

                {checkin.bodyPhotos.length ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {checkin.bodyPhotos.map((photo, index) => (
                      <div key={photo.id} className="group relative overflow-hidden rounded-[14px] bg-surface-secondary">
                        <Image src={bodyPhotoSrc(photo)} alt={`Foto ${index + 1} do check-in ${checkin.weekStart.toLocaleDateString("pt-BR")}`} width={360} height={480} unoptimized className="aspect-[3/4] w-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-[rgba(0,0,0,0.6)] p-2 text-xs backdrop-blur">
                          <span>Foto {index + 1}</span>
                          <form action={deleteBodyPhotoAction}>
                            <input type="hidden" name="photoId" value={photo.id} />
                            <button className="min-h-8 rounded-full bg-fill px-3 text-text-primary hover:bg-danger/20 hover:text-danger">Apagar</button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {checkin.bodyPhotos.length < 8 ? <BodyPhotoUploader checkinId={checkin.id} remainingSlots={8 - checkin.bodyPhotos.length} /> : null}
              </div>
            ))}
    {!checkins.length && <p className={sections.empty}>Seus check-ins aparecerão aqui. <a href="#novo-checkin">Registrar o primeiro</a></p>}
  </div></section>;
  return <AppShell>
    <PageHeading title="Progresso" description="Seu corpo, semana após semana." />
    <WorkspaceTabs label="Acompanhamento corporal" items={[
      { id: "evolucao", label: "Evolução", content: overview },
      { id: "novo-checkin", label: "Novo check-in", content: <CheckinWizard sex={sex} defaults={{ waistCm:currentBody.waistCm, neckCm:currentBody.neckCm, hipCm:currentBody.hipCm, chestCm:currentBody.chestCm, armCm:currentBody.armCm, thighCm:currentBody.thighCm, calfCm:currentBody.calfCm }} action={saveWeeklyCheckinAction} /> },
      { id: "historico", label: "Histórico", content: history },
    ]} />
  </AppShell>;
}

function bodyPhotoSrc(photo: { imageMimeType: string; imageData: Uint8Array }) {
  return `data:${photo.imageMimeType};base64,${Buffer.from(photo.imageData).toString("base64")}`;
}
