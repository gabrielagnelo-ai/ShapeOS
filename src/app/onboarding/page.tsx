import { OnboardingMode } from "@/components/onboarding/onboarding-mode";
import { SubmitButton } from "@/components/ui/submit-button";
﻿import { redirect } from "next/navigation";
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
  "conhecimento de dieta": "experience",
  restrições: "restrictions",
  alergias: "allergies",
  "alimentos que não gosta": "dislikedFoods",
  "condições médicas": "medicalConditions",
  "preferência alimentar": "dietPreference",
};

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ onboardingError?: string; field?: string }> }) {
  const { onboardingError, field: errorField } = await searchParams;
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
      {onboardingError ? <p role="alert" className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/5 p-4 text-sm text-amber-100">{onboardingError === "invalid-target" ? "As metas calculadas precisam de revisão. Confira peso, altura e ajustes avançados." : `Confira os dados informados${errorField ? ` no campo ${Object.entries(fieldNames).find(([, value]) => value === errorField)?.[0] ?? "indicado"}` : ""} e tente novamente.`}</p> : null}
      <GlassCard className="mt-8">
        <form action={saveOnboardingAction}>
          <OnboardingMode advanced={<FieldSection icon={<Settings2 size={18} />} title="Ajustes avançados" text="Ajuste estas opções se você já acompanha suas metas ou recebeu orientação profissional.">
              <div className="grid gap-4 md:grid-cols-2">
                {["déficit calórico", "proteína por kg", "gordura por kg", "fator de atividade manual"].map((field) => <Field key={field} field={field} />)}
              </div>
            </FieldSection>}>
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
                {["objetivo", "nível de atividade", "conhecimento de dieta", "preferência alimentar"].map((field) => <Field key={field} field={field} />)}
              </div>
            </FieldSection>



            <FieldSection icon={<Utensils size={18} />} title="3. Preferências alimentares" text="Informe alergias e restrições. Quando a composição não puder ser verificada, você poderá montar um plano manual revisado.">
              <div className="grid gap-4 md:grid-cols-2">
                {["restrições", "alergias", "alimentos que não gosta"].map((field) => <Field key={field} field={field} />)}
              </div>
            </FieldSection>

            <FieldSection icon={<HeartPulse size={18} />} title="4. Saúde" text="O ShapeOS não faz prescrição clínica. Se algo se aplica, use acompanhamento profissional.">
              <Field field="condições médicas" />
            </FieldSection>
          </OnboardingMode>
          <div className="mt-6"><SubmitButton pendingLabel="Preparando seu perfil…">Salvar perfil e continuar</SubmitButton></div>
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

  if (field === "conhecimento de dieta") {
    return <select name={name} className={className} defaultValue="" required><option value="" disabled>Escolha seu nível de controle sobre dieta</option><option value="beginner">Preciso de guia - não acompanho calorias/macros</option><option value="intermediate">Intermediário - entendo o básico e registro às vezes</option><option value="advanced">Autônomo - sei ajustar macros, calorias e estratégia</option></select>;
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

  if (field === "preferência alimentar") {
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
      inputMode={["idade", "altura", "peso", "pescoco", "cintura", "quadril"].includes(field) ? "decimal" : undefined}
      maxLength={field === "nome" ? 120 : 500}
      className={className}
      placeholder={measurementPlaceholder(field)}
      required={["nome", "idade", "altura", "peso", "pescoco", "cintura"].includes(field)}
    />
  );
}

function measurementPlaceholder(field: string) {
  if (field === "altura") return "cm ou metros. Ex.: 180 ou 1,80";
  if (field === "peso") return "kg. Ex.: 80,5";
  if (field === "idade") return "anos. Ex.: 30";
  if (["alergias", "restrições", "alimentos que não gosta"].includes(field)) return "Separe por vírgulas; deixe vazio se não houver";
  if (field === "pescoco") return "cm. Ex: 43";
  if (field === "cintura") return "cm na linha do umbigo. Ex: 108";
  if (field === "quadril") return "cm. Obrigatório para mulheres";
  return field;
}
