import Image from "next/image";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { bodyStateFromLatestSnapshot, recalculateBodyCompositionSnapshots } from "@/lib/body-composition";
import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/profile";
import { suggestCalorieAdjustment, type Goal } from "@/lib/nutrition";
import { deleteBodyPhotoAction, deleteWeeklyCheckinAction, saveWeeklyCheckinAction } from "./actions";
import { BodyPhotoUploader } from "./body-photo-uploader";

const goalMap = { FAT_LOSS: "fat_loss", MAINTENANCE: "maintenance", MUSCLE_GAIN: "muscle_gain" } as const;
const inputClass = "h-12 rounded-2xl border border-white/10 bg-black/30 px-4 outline-none focus:border-lime-300/50";

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
    take: 12,
  });
  const bodySnapshots = recalculateBodyCompositionSnapshots(rawBodySnapshots, {
    sex: profile.sex === "MALE" ? "male" : "female",
    heightCm: profile.heightCm,
  });
  const currentBody = bodyStateFromLatestSnapshot(profile, bodySnapshots);
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

  return (
    <AppShell>
      <h1 className="text-4xl font-semibold tracking-tight">Acompanhamento semanal</h1>
      <p className="mt-3 text-zinc-400">Check-ins salvos no Supabase para orientar ajustes de calorias e composição corporal.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ["Peso medio", latest ? `${latest.averageWeightKg} kg` : "-"],
          ["Cintura", latest?.waistCm ? `${latest.waistCm} cm` : "-"],
          ["Adesao", latest ? `${latest.adherencePct}%` : "-"],
          ["Fome", latest ? `${latest.hunger}/10` : "-"],
          ["Energia", latest ? `${latest.energy}/10` : "-"],
          ["Sono", latest ? `${latest.sleep}/10` : "-"],
        ].map(([label, value]) => (
          <GlassCard key={label}>
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
          </GlassCard>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
        <GlassCard>
          <h2 className="text-xl font-semibold">Novo check-in</h2>
          <form action={saveWeeklyCheckinAction} className="mt-5 grid gap-3">
            <input name="averageWeightKg" inputMode="decimal" className={inputClass} placeholder="Peso medio da semana" required />
            <div className={`grid gap-3 ${profile.sex === "FEMALE" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              <input name="waistCm" inputMode="decimal" className={inputClass} placeholder="Cintura em cm" defaultValue={formatInput(currentBody.waistCm)} required />
              <input name="neckCm" inputMode="decimal" className={inputClass} placeholder="Pescoco em cm" defaultValue={formatInput(currentBody.neckCm)} required />
              {profile.sex === "FEMALE" ? <input name="hipCm" inputMode="decimal" className={inputClass} placeholder="Quadril em cm" defaultValue={formatInput(currentBody.hipCm)} required /> : null}
            </div>
            <input name="adherencePct" inputMode="decimal" className={inputClass} placeholder="Adesao a dieta %" required />
            <div className="grid gap-3 sm:grid-cols-3">
              <input name="hunger" type="number" min="1" max="10" className={inputClass} placeholder="Fome 1-10" required />
              <input name="energy" type="number" min="1" max="10" className={inputClass} placeholder="Energia 1-10" required />
              <input name="sleep" type="number" min="1" max="10" className={inputClass} placeholder="Sono 1-10" required />
            </div>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <input name="trainingDone" type="checkbox" className="size-4" />
              Treino realizado nesta semana
            </label>
            <div className="rounded-3xl border border-dashed border-white/15 bg-black/20 p-4">
              <p className="text-sm font-semibold text-zinc-200">Fotos corporais opcionais</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Anexe ate 8 fotos neste check-in. Use frente, lado e costas com luz parecida para comparar melhor.</p>
              <input name="bodyPhotos" type="file" accept="image/*" multiple className="mt-3 w-full rounded-2xl bg-white/8 px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-full file:border-0 file:bg-lime-300 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black" />
            </div>
            <textarea name="notes" className="min-h-24 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-lime-300/50" placeholder="Observacoes" />
            <button className="rounded-full bg-lime-300 px-5 py-3 font-semibold text-black">Salvar check-in</button>
          </form>
        </GlassCard>

        <GlassCard>
          <h2 className="text-xl font-semibold">Ajuste automatico</h2>
          <p className="mt-3 text-zinc-400">{adjustment.reason}</p>
          <p className="mt-5 text-4xl font-semibold text-lime-300">{adjustment.delta > 0 ? "+" : ""}{adjustment.delta} kcal</p>
          <div className="mt-6 grid gap-3">
            {checkins.map((checkin) => (
              <div key={checkin.id} className="rounded-3xl bg-white/[0.04] p-4 text-sm text-zinc-300">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-100">{checkin.weekStart.toLocaleDateString("pt-BR")}</p>
                    <p className="mt-1 text-zinc-400">{checkin.averageWeightKg} kg - adesao {checkin.adherencePct}% - {checkin.bodyPhotos.length}/8 fotos</p>
                  </div>
                  <form action={deleteWeeklyCheckinAction}>
                    <input type="hidden" name="checkinId" value={checkin.id} />
                    <button className="grid size-9 place-items-center rounded-full bg-white/10 text-zinc-400 transition hover:bg-red-500/20 hover:text-red-200" aria-label="Excluir check-in">
                      <Trash2 size={15} />
                    </button>
                  </form>
                </div>

                {checkin.bodyPhotos.length ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {checkin.bodyPhotos.map((photo, index) => (
                      <div key={photo.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                        <Image src={bodyPhotoSrc(photo)} alt={`Foto ${index + 1} do check-in ${checkin.weekStart.toLocaleDateString("pt-BR")}`} width={360} height={480} unoptimized className="aspect-[3/4] w-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/65 p-2 text-xs backdrop-blur">
                          <span>Foto {index + 1}</span>
                          <form action={deleteBodyPhotoAction}>
                            <input type="hidden" name="photoId" value={photo.id} />
                            <button className="rounded-full bg-white/10 px-2 py-1 text-zinc-300 transition hover:bg-red-500/30 hover:text-red-100">Apagar</button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {checkin.bodyPhotos.length < 8 ? <BodyPhotoUploader checkinId={checkin.id} remainingSlots={8 - checkin.bodyPhotos.length} /> : null}
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}

function formatInput(value?: number | null) {
  return typeof value === "number" ? String(value).replace(".", ",") : "";
}

function bodyPhotoSrc(photo: { imageMimeType: string; imageData: Uint8Array }) {
  return `data:${photo.imageMimeType};base64,${Buffer.from(photo.imageData).toString("base64")}`;
}
