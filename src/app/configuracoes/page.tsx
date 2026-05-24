import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { DeficitAdvisor } from "@/components/onboarding/deficit-advisor";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateGoalsAction } from "./actions";

const inputClass = "mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none transition focus:border-lime-300/50";

export default async function ConfiguracoesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?erro=Sessao nao encontrada. Entre novamente.");

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-sm text-lime-300">Metas</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Ajustar calculos</h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Ajuste deficit, fator de atividade, proteina e gordura sem refazer o onboarding. Carboidrato fica automatico com as calorias restantes.
        </p>
      </div>

      <GlassCard>
        <form action={updateGoalsAction} className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="text-sm text-zinc-400">Fator de atividade</span>
            <input name="activityFactor" defaultValue={String(profile.activityFactor).replace(".", ",")} inputMode="decimal" className={inputClass} />
            <p className="mt-2 text-xs leading-5 text-zinc-500">Use algo entre 1,1 e 2,2. Exemplo: 1,45 para uma rotina ativa, mas sem inflar o TDEE.</p>
          </label>

          <label className="block">
            <span className="text-sm text-zinc-400">Deficit calorico</span>
            <DeficitAdvisor name="calorieDeficitKcal" className={inputClass} defaultValue={profile.calorieDeficitKcal ?? 400} />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-400">Peso atual em kg</span>
            <input name="weightKg" defaultValue={String(profile.weightKg).replace(".", ",")} inputMode="decimal" className={inputClass} />
            <p className="mt-2 text-xs leading-5 text-zinc-500">Ao salvar, o ShapeOS registra um snapshot de BF e massa magra estimada.</p>
          </label>

          <label className="block">
            <span className="text-sm text-zinc-400">Proteina por kg</span>
            <input name="proteinPerKg" defaultValue={String(profile.proteinPerKg ?? 1.8).replace(".", ",")} inputMode="decimal" className={inputClass} />
            <p className="mt-2 text-xs leading-5 text-zinc-500">Faixa aceita: 1,2 a 3,0 g/kg.</p>
          </label>

          <label className="block">
            <span className="text-sm text-zinc-400">Gordura por kg</span>
            <input name="fatPerKg" defaultValue={String(profile.fatPerKg ?? 0.8).replace(".", ",")} inputMode="decimal" className={inputClass} />
            <p className="mt-2 text-xs leading-5 text-zinc-500">Faixa aceita: 0,4 a 1,5 g/kg. Carboidrato sera calculado pelo restante.</p>
          </label>

          <label className="block">
            <span className="text-sm text-zinc-400">Pescoco em cm</span>
            <input name="neckCm" defaultValue={profile.neckCm ? String(profile.neckCm).replace(".", ",") : ""} inputMode="decimal" className={inputClass} />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-400">Cintura em cm</span>
            <input name="waistCm" defaultValue={profile.waistCm ? String(profile.waistCm).replace(".", ",") : ""} inputMode="decimal" className={inputClass} />
          </label>

          {profile.sex === "FEMALE" ? (
            <label className="block">
              <span className="text-sm text-zinc-400">Quadril em cm</span>
              <input
                name="hipCm"
                defaultValue={profile.hipCm ? String(profile.hipCm).replace(".", ",") : ""}
                inputMode="decimal"
                className={inputClass}
                required
              />
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Obrigatorio para calcular BF feminino pelo metodo da Marinha.
              </p>
            </label>
          ) : null}

          <label className="block md:col-span-2">
            <span className="text-sm text-zinc-400">Preferencia alimentar para IA</span>
            <select name="dietPreference" defaultValue={profile.dietPreference ?? "balanced"} className={inputClass}>
              <option value="balanced">Equilibrado - saciedade e prazer</option>
              <option value="satiety">Mais saciedade - volume, fibra e proteina</option>
              <option value="pleasure">Mais prazer - encaixar alimentos gostosos com controle</option>
              <option value="low_meal_volume">Comer menos volume - refeicoes menores e densas</option>
              <option value="simple_repetitive">Simples e repetitivo - praticidade maxima</option>
            </select>
          </label>

          <div className="md:col-span-2">
            <button className="rounded-full bg-lime-300 px-6 py-3 font-semibold text-black transition hover:bg-lime-200">
              Salvar e recalcular
            </button>
          </div>
        </form>
      </GlassCard>
    </AppShell>
  );
}
