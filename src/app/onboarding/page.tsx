import { redirect } from "next/navigation";
import { Activity, HeartPulse, Scale, Settings2, Utensils } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { DeficitAdvisor } from "@/components/onboarding/deficit-advisor";
import { SexAwareMeasurements } from "@/components/onboarding/sex-aware-measurements";
import { getCurrentUser } from "@/lib/auth";
import { saveOnboardingAction } from "./actions";

const fieldNames: Record<string, string> = {
  nome: "name",
  sexo: "sex",
  idade: "age",
  altura: "height",
  peso: "weight",
  pescoco: "neckCm",
  cintura: "waistCm",
  quadril: "hipCm",
  objetivo: "goal",
  "déficit calórico": "calorieDeficitKcal",
  "proteína por kg": "proteinPerKg",
  "gordura por kg": "fatPerKg",
  "nível de atividade": "activityLevel",
  "fator de atividade manual": "manualActivityFactor",
  experiência: "experience",
  restrições: "restrictions",
  alergias: "allergies",
  "alimentos que não gosta": "dislikedFoods",
  "condições médicas": "medicalConditions",
  "preferencia alimentar": "dietPreference",
};

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?erro=Sessão não encontrada. Entre novamente.");

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
        <div>
          <p className="text-sm font-medium text-lime-300">Primeira configuração</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Vamos montar sua base sem complicar.</h1>
          <p className="mt-4 max-w-2xl text-zinc-400">
            Responda como você vive hoje. O ShapeOS calcula calorias, proteínas, gorduras e deixa carboidrato como o restante da meta.
          </p>
        </div>
        <GlassCard className="bg-lime-300/10">
          <p className="text-sm font-semibold text-lime-200">O que acontece ao finalizar</p>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-zinc-300">
            <p>1. Seu gasto diário e sua meta calórica são calculados.</p>
            <p>2. Seu percentual de gordura estimado fica salvo no histórico.</p>
            <p>3. A tela Hoje mostra a próxima ação para começar.</p>
          </div>
        </GlassCard>
      </div>
      <GlassCard className="mt-8">
        <form action={saveOnboardingAction}>
          <div className="grid gap-5">
            <FieldSection icon={<Scale size={18} />} title="1. Seu corpo e medidas" text="Dados usados para calcular metabolismo, IMC e gordura estimada. Quadril só aparece para mulheres.">
              <div className="grid gap-4 md:grid-cols-2">
                {["nome", "sexo", "idade", "altura", "peso"].map((field) => (
                  field === "sexo" ? (
                    <SexAwareMeasurements key="sex-measurements" className="mt-2 h-12 w-full appearance-none rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none transition focus:border-lime-300/50 disabled:cursor-not-allowed disabled:opacity-45" />
                  ) : (
                    <Field key={field} field={field} defaultValue={field === "nome" ? user.name : undefined} />
                  )
                ))}
              </div>
            </FieldSection>

            <FieldSection icon={<Activity size={18} />} title="2. Objetivo e rotina" text="Escolha o cenário mais parecido com sua semana. Não precisa acertar perfeito agora.">
              <div className="grid gap-4 md:grid-cols-2">
                {["objetivo", "nível de atividade", "experiência", "preferencia alimentar"].map((field) => <Field key={field} field={field} />)}
              </div>
            </FieldSection>

            <FieldSection icon={<Settings2 size={18} />} title="3. Metas ajustáveis" text="Usuário avançado pode reduzir inflação do gasto e escolher déficit, proteína e gordura.">
              <div className="grid gap-4 md:grid-cols-2">
                {["déficit calórico", "proteína por kg", "gordura por kg", "fator de atividade manual"].map((field) => <Field key={field} field={field} />)}
              </div>
            </FieldSection>

            <FieldSection icon={<Utensils size={18} />} title="4. Preferências alimentares" text="Isso ajuda a IA a evitar uma dieta bonita no papel e ruim de seguir.">
              <div className="grid gap-4 md:grid-cols-2">
                {["restrições", "alergias", "alimentos que não gosta"].map((field) => <Field key={field} field={field} />)}
              </div>
            </FieldSection>

            <FieldSection icon={<HeartPulse size={18} />} title="5. Segurança" text="O ShapeOS não faz prescrição clínica. Se algo se aplica, use acompanhamento profissional.">
              <Field field="condições médicas" />
            </FieldSection>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button name="mode" value="guided" type="submit" className="rounded-full bg-lime-300 px-5 py-3 font-medium text-black">
              Continuar no modo guiado
            </button>
            <button name="mode" value="advanced" type="submit" className="rounded-full border border-white/15 px-5 py-3 font-medium text-white">
              Continuar no modo avançado
            </button>
          </div>
        </form>
      </GlassCard>
    </AppShell>
  );
}

function FieldSection({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-black/20 p-4 md:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-lime-300/15 text-lime-300">{icon}</div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">{text}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ field, defaultValue }: { field: string; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="text-sm capitalize text-zinc-400">{field}</span>
      {renderField(field, fieldNames[field], defaultValue)}
    </label>
  );
}

function renderField(field: string, name: string, defaultValue?: string) {
  const className = "mt-2 h-12 w-full appearance-none rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none transition focus:border-lime-300/50";

  if (field === "objetivo") {
    return <select name={name} className={className} defaultValue="" required><option value="" disabled>Selecione</option><option value="maintenance">Manutenção</option><option value="fat_loss">Perda de peso</option><option value="muscle_gain">Ganho de massa muscular</option></select>;
  }

  if (field === "déficit calórico") {
    return <DeficitAdvisor name={name} className={className} />;
  }

  if (field === "proteína por kg") {
    return <input name={name} inputMode="decimal" className={className} placeholder="Ex: 2,0 g/kg" defaultValue="2,0" />;
  }

  if (field === "gordura por kg") {
    return <input name={name} inputMode="decimal" className={className} placeholder="Ex: 0,8 g/kg" defaultValue="0,8" />;
  }

  if (field === "nível de atividade") {
    return <select name={name} className={className} defaultValue="" required><option value="" disabled>Escolha o mais parecido com sua rotina</option><option value="sedentary">Sedentário - quase não caminha ou treina</option><option value="light">Leve - caminha ou treina 1 a 3 dias/semana</option><option value="moderate">Moderado - treina 3 a 5 dias/semana</option><option value="high">Alto - treina pesado 5 a 6 dias/semana</option><option value="very_high">Muito alto - trabalho físico ou 2 treinos/dia</option></select>;
  }

  if (field === "experiência") {
    return <select name={name} className={className} defaultValue="" required><option value="" disabled>Escolha o quanto você já acompanha dieta e treino</option><option value="beginner">Iniciante - quero que o app me guie no básico</option><option value="intermediate">Intermediário - já treino e sigo dieta às vezes</option><option value="advanced">Avançado - já controlo macros, calorias e ajustes</option></select>;
  }

  if (field === "fator de atividade manual") {
    return (
      <input
        name={name}
        inputMode="decimal"
        className={className}
        placeholder="Opcional no modo avançado. Ex: 1,45"
      />
    );
  }

  if (field === "condições médicas") {
    return <select name={name} className={className} defaultValue="" required><option value="" disabled>Selecione se algo se aplica a você</option><option value="none">Nenhuma condição relevante</option><option value="diabetes">Diabetes ou glicemia alterada</option><option value="kidney">Doença renal ou restrição de proteína</option><option value="heart">Doença cardíaca ou pressão alta</option><option value="pregnancy">Gestação ou amamentação</option><option value="eating_disorder">Histórico de transtorno alimentar</option><option value="medication">Uso de medicamentos que afetam peso/apetite</option><option value="other">Outra condição - quero informar depois</option></select>;
  }

  if (field === "preferencia alimentar") {
    return (
      <select name={name} className={className} defaultValue="balanced">
        <option value="balanced">Equilibrado - saciedade e prazer</option>
        <option value="satiety">Mais saciedade - volume, fibra e proteína</option>
        <option value="pleasure">Mais prazer - encaixar alimentos gostosos com controle</option>
        <option value="low_meal_volume">Comer menos volume - refeições menores e densas</option>
        <option value="simple_repetitive">Simples e repetitivo - praticidade máxima</option>
      </select>
    );
  }

  return (
    <input
      name={name}
      defaultValue={defaultValue}
      className={className}
      placeholder={measurementPlaceholder(field)}
      required={["nome", "idade", "altura", "peso", "pescoco", "cintura"].includes(field)}
    />
  );
}

function measurementPlaceholder(field: string) {
  if (field === "altura") return "ex: 1,92 ou 192";
  if (field === "pescoco") return "cm. Ex: 43";
  if (field === "cintura") return "cm na linha do umbigo. Ex: 108";
  if (field === "quadril") return "cm. Obrigatório para mulheres";
  return field;
}
