import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/profile";
import { suggestCalorieAdjustment, type Goal } from "@/lib/nutrition";
import { saveWeeklyCheckinAction } from "./actions";

const goalMap = { FAT_LOSS: "fat_loss", MAINTENANCE: "maintenance", MUSCLE_GAIN: "muscle_gain" } as const;
const inputClass = "h-12 rounded-2xl border border-white/10 bg-black/30 px-4 outline-none focus:border-lime-300/50";

export default async function AcompanhamentoPage() {
  const { user, profile } = await requireUserProfile();
  const checkins = await prisma.weeklyCheckin.findMany({
    where: { userId: user.id },
    orderBy: { weekStart: "desc" },
    take: 8,
  });
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
      <p className="mt-3 text-zinc-400">Check-in salvo no Supabase para orientar ajustes de calorias.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ["Peso médio", latest ? `${latest.averageWeightKg} kg` : "-"],
          ["Cintura", latest?.waistCm ? `${latest.waistCm} cm` : "-"],
          ["Adesão", latest ? `${latest.adherencePct}%` : "-"],
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
            <input name="averageWeightKg" inputMode="decimal" className={inputClass} placeholder="Peso médio da semana" required />
            <input name="waistCm" inputMode="decimal" className={inputClass} placeholder="Cintura em cm (opcional)" />
            <input name="adherencePct" inputMode="decimal" className={inputClass} placeholder="Adesão à dieta %" required />
            <div className="grid gap-3 sm:grid-cols-3">
              <input name="hunger" type="number" min="1" max="10" className={inputClass} placeholder="Fome 1-10" required />
              <input name="energy" type="number" min="1" max="10" className={inputClass} placeholder="Energia 1-10" required />
              <input name="sleep" type="number" min="1" max="10" className={inputClass} placeholder="Sono 1-10" required />
            </div>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <input name="trainingDone" type="checkbox" className="size-4" />
              Treino realizado nesta semana
            </label>
            <textarea name="notes" className="min-h-24 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-lime-300/50" placeholder="Observações" />
            <button className="rounded-full bg-lime-300 px-5 py-3 font-semibold text-black">Salvar check-in</button>
          </form>
        </GlassCard>

        <GlassCard>
          <h2 className="text-xl font-semibold">Ajuste automático</h2>
          <p className="mt-3 text-zinc-400">{adjustment.reason}</p>
          <p className="mt-5 text-4xl font-semibold text-lime-300">{adjustment.delta > 0 ? "+" : ""}{adjustment.delta} kcal</p>
          <div className="mt-6 grid gap-3">
            {checkins.map((checkin) => (
              <div key={checkin.id} className="rounded-2xl bg-white/[0.04] p-4 text-sm text-zinc-300">
                {checkin.weekStart.toLocaleDateString("pt-BR")} - {checkin.averageWeightKg} kg - adesão {checkin.adherencePct}%
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
