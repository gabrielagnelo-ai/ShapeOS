import { redirect } from "next/navigation";
import { Gauge, HeartPulse, Ruler, Save, Sparkles, Target, Utensils } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { DeficitAdvisor } from "@/components/onboarding/deficit-advisor";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeProfileMetrics } from "@/lib/profile";
import { updateGoalsAction } from "./actions";

const inputClass = "mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-white shadow-inner shadow-black/20 outline-none transition placeholder:text-zinc-600 focus:border-lime-300/55 focus:bg-black/50 focus:ring-4 focus:ring-lime-300/10";

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

  const metrics = computeProfileMetrics(profile);
  const calorieDeficit = profile.calorieDeficitKcal ?? 400;
  const deficitPct = metrics.tdee ? Math.round((calorieDeficit / metrics.tdee) * 100) : 0;
  const macroCalories = metrics.targets.proteinG * 4 + metrics.targets.fatG * 9 + metrics.targets.carbsG * 4;

  return (
    <AppShell>
      <div className="grid gap-5 lg:grid-cols-[1fr_420px] lg:items-end">
        <div>
          <p className="text-sm font-semibold text-lime-300">Metas e ajustes</p>
          <h1 className="mt-3 max-w-4xl text-5xl font-semibold tracking-tight md:text-6xl">
            Controle sua dieta sem mexer no plano inteiro.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-400">
            Ajuste gasto, déficit, proteína, gordura e medidas corporais. O ShapeOS recalcula carboidratos e registra evolução de composição corporal.
          </p>
        </div>

        <GlassCard className="border-lime-300/25 bg-lime-300/[0.08]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-400">Meta atual</p>
              <p className="mt-2 text-5xl font-semibold tracking-tight text-white">{metrics.targets.calories}</p>
              <p className="mt-1 text-sm text-lime-200">kcal/dia para {goalLabels[metrics.goal]}</p>
            </div>
            <div className="grid size-16 place-items-center rounded-3xl bg-lime-300 text-black shadow-[0_0_45px_rgba(184,255,0,.22)]">
              <Target size={28} />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            <MiniMetric label="P" value={`${metrics.targets.proteinG}g`} />
            <MiniMetric label="C" value={`${metrics.targets.carbsG}g`} />
            <MiniMetric label="G" value={`${metrics.targets.fatG}g`} />
          </div>
        </GlassCard>
      </div>

      <form action={updateGoalsAction} className="mt-8 grid items-start gap-5 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-5">
          <SectionCard
            icon={<Gauge size={20} />}
            title="Gasto e déficit"
            text="Aqui você controla o cálculo mais sensível. Para usuário avançado, o fator manual evita inflar o gasto estimado."
          >
            <div className="grid gap-4 md:grid-cols-2">
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
            title="Macros"
            text="Proteína e gordura entram por kg. Carboidrato fica automático com as calorias restantes do cutting."
          >
            <div className="grid gap-4 md:grid-cols-2">
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
            text="Essas medidas alimentam BF estimado pelo método da Marinha Americana e ficam registradas como snapshot ao salvar."
          >
            <div className="grid gap-4 md:grid-cols-2">
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
                <Field label="Quadril em cm" help="Obrigatório para calcular BF feminino pelo método da Marinha.">
                  <input name="hipCm" defaultValue={profile.hipCm ? formatInput(profile.hipCm) : ""} inputMode="decimal" className={inputClass} required />
                </Field>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            icon={<Sparkles size={20} />}
            title="Preferência da IA"
            text="Isso muda como o gerador de dieta escolhe alimentos: mais saciedade, mais prazer, menor volume ou mais praticidade."
          >
            <Field label="Estilo alimentar">
              <select name="dietPreference" defaultValue={profile.dietPreference ?? "balanced"} className={inputClass}>
                <option value="balanced">Equilibrado - saciedade e prazer</option>
                <option value="satiety">Mais saciedade - volume, fibra e proteína</option>
                <option value="pleasure">Mais prazer - encaixar alimentos gostosos com controle</option>
                <option value="low_meal_volume">Comer menos volume - refeições menores e densas</option>
                <option value="simple_repetitive">Simples e repetitivo - praticidade máxima</option>
              </select>
            </Field>
          </SectionCard>
        </div>

        <aside className="grid gap-5 xl:sticky xl:top-28">
          <GlassCard className="p-0">
            <div className="border-b border-white/10 p-5">
              <p className="text-sm font-semibold text-lime-300">Impacto atual</p>
              <h2 className="mt-2 text-2xl font-semibold">Resumo metabólico</h2>
            </div>
            <div className="grid gap-3 p-5">
              <SummaryLine label="Repouso" value={`${metrics.bmr} kcal`} detail="BMR estimado" />
              <SummaryLine label="Gasto diário" value={`${metrics.tdee} kcal`} detail={`fator ${formatInput(profile.activityFactor)}`} />
              <SummaryLine label="Déficit" value={`${calorieDeficit} kcal`} detail={`${deficitPct}% do gasto`} tone={deficitPct >= 25 ? "danger" : deficitPct >= 18 ? "warning" : "good"} />
              <SummaryLine label="Macros" value={`${macroCalories} kcal`} detail="P 4 / C 4 / G 9 kcal por g" />
              <SummaryLine label="BF estimado" value={metrics.bodyFat.percentage == null ? "pendente" : `${metrics.bodyFat.percentage}%`} detail="método da Marinha" />
            </div>
          </GlassCard>

          <GlassCard className="border-white/10 bg-black/35">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-300/15 text-sky-200">
                <HeartPulse size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Regra de segurança</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Déficit alto pode funcionar por um tempo, mas aumenta risco de fome, piora no treino e perda de massa magra. Revise pelo Coach semanalmente.
                </p>
              </div>
            </div>
          </GlassCard>

          <button className="group relative inline-flex h-14 items-center justify-center gap-2 overflow-hidden rounded-full bg-lime-300 px-6 font-semibold text-black shadow-[0_18px_55px_rgba(184,255,0,.18)] transition hover:bg-lime-200">
            <span className="absolute inset-y-0 left-0 w-1/3 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition duration-700 group-hover:translate-x-[320%]" />
            <Save size={18} />
            Salvar e recalcular
          </button>
        </aside>
      </form>
    </AppShell>
  );
}

function SectionCard({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  return (
    <GlassCard>
      <div className="mb-5 flex items-start gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime-300/15 text-lime-300">{icon}</div>
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">{text}</p>
        </div>
      </div>
      {children}
    </GlassCard>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      {children}
      {help ? <p className="mt-2 text-xs leading-5 text-zinc-500">{help}</p> : null}
    </label>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-center">
      <p className="text-xs font-semibold text-lime-300">{label}</p>
      <p className="mt-1 font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function SummaryLine({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "good" | "warning" | "danger" }) {
  const toneClass =
    tone === "danger"
      ? "border-red-400/20 bg-red-400/10 text-red-100"
      : tone === "warning"
        ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
        : tone === "good"
          ? "border-lime-300/20 bg-lime-300/10 text-lime-100"
          : "border-white/10 bg-white/[0.04] text-zinc-100";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function formatInput(value: number) {
  return String(value).replace(".", ",");
}
