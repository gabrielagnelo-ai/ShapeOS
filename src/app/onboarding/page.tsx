import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { DeficitAdvisor } from "@/components/onboarding/deficit-advisor";
import { SexAwareMeasurements } from "@/components/onboarding/sex-aware-measurements";
import { getCurrentUser } from "@/lib/auth";
import { saveOnboardingAction } from "./actions";

const fields = [
  "nome",
  "sexo",
  "idade",
  "altura",
  "peso",
  "pescoco",
  "cintura",
  "quadril",
  "objetivo",
  "deficit calorico",
  "proteina por kg",
  "gordura por kg",
  "nivel de atividade",
  "fator de atividade manual",
  "experiencia",
  "restricoes",
  "alergias",
  "alimentos que nao gosta",
  "condicoes medicas",
  "preferencia alimentar",
];

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
  "deficit calorico": "calorieDeficitKcal",
  "proteina por kg": "proteinPerKg",
  "gordura por kg": "fatPerKg",
  "nivel de atividade": "activityLevel",
  "fator de atividade manual": "manualActivityFactor",
  experiencia: "experience",
  restricoes: "restrictions",
  alergias: "allergies",
  "alimentos que nao gosta": "dislikedFoods",
  "condicoes medicas": "medicalConditions",
  "preferencia alimentar": "dietPreference",
};

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?erro=Sessao nao encontrada. Entre novamente.");

  return (
    <AppShell>
      <h1 className="text-4xl font-semibold tracking-tight">Onboarding</h1>
      <p className="mt-3 max-w-2xl text-zinc-400">
        Preencha uma vez. Proteina e gordura podem ser ajustadas; no cutting, carboidrato fica sempre com as calorias restantes.
      </p>
      <GlassCard className="mt-8">
        <form action={saveOnboardingAction}>
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map((field) => (
              field === "sexo" ? (
                <SexAwareMeasurements key="sex-measurements" className="mt-2 h-12 w-full appearance-none rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none transition focus:border-lime-300/50 disabled:cursor-not-allowed disabled:opacity-45" />
              ) : ["pescoco", "cintura", "quadril"].includes(field) ? null : (
              <label key={field} className="block">
                <span className="text-sm capitalize text-zinc-400">{field}</span>
                {renderField(field, fieldNames[field], field === "nome" ? user.name : undefined)}
              </label>
              )
            ))}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button name="mode" value="guided" type="submit" className="rounded-full bg-lime-300 px-5 py-3 font-medium text-black">
              Continuar no modo guiado
            </button>
            <button name="mode" value="advanced" type="submit" className="rounded-full border border-white/15 px-5 py-3 font-medium text-white">
              Continuar no modo avancado
            </button>
          </div>
        </form>
      </GlassCard>
    </AppShell>
  );
}

function renderField(field: string, name: string, defaultValue?: string) {
  const className = "mt-2 h-12 w-full appearance-none rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none transition focus:border-lime-300/50";

  if (field === "objetivo") {
    return <select name={name} className={className} defaultValue="" required><option value="" disabled>Selecione</option><option value="maintenance">Manutencao</option><option value="fat_loss">Perda de peso</option><option value="muscle_gain">Ganho de massa muscular</option></select>;
  }

  if (field === "deficit calorico") {
    return <DeficitAdvisor name={name} className={className} />;
  }

  if (field === "proteina por kg") {
    return <input name={name} inputMode="decimal" className={className} placeholder="Ex: 2,0 g/kg" defaultValue="2,0" />;
  }

  if (field === "gordura por kg") {
    return <input name={name} inputMode="decimal" className={className} placeholder="Ex: 0,8 g/kg" defaultValue="0,8" />;
  }

  if (field === "nivel de atividade") {
    return <select name={name} className={className} defaultValue="" required><option value="" disabled>Escolha o mais parecido com sua rotina</option><option value="sedentary">Sedentario - quase nao caminha ou treina</option><option value="light">Leve - caminha ou treina 1 a 3 dias/semana</option><option value="moderate">Moderado - treina 3 a 5 dias/semana</option><option value="high">Alto - treina pesado 5 a 6 dias/semana</option><option value="very_high">Muito alto - trabalho fisico ou 2 treinos/dia</option></select>;
  }

  if (field === "experiencia") {
    return <select name={name} className={className} defaultValue="" required><option value="" disabled>Escolha o quanto voce ja acompanha dieta e treino</option><option value="beginner">Iniciante - quero que o app me guie no basico</option><option value="intermediate">Intermediario - ja treino e sigo dieta as vezes</option><option value="advanced">Avancado - ja controlo macros, calorias e ajustes</option></select>;
  }

  if (field === "fator de atividade manual") {
    return (
      <input
        name={name}
        inputMode="decimal"
        className={className}
        placeholder="Opcional no modo avancado. Ex: 1,45"
      />
    );
  }

  if (field === "condicoes medicas") {
    return <select name={name} className={className} defaultValue="" required><option value="" disabled>Selecione se algo se aplica a voce</option><option value="none">Nenhuma condicao relevante</option><option value="diabetes">Diabetes ou glicemia alterada</option><option value="kidney">Doenca renal ou restricao de proteina</option><option value="heart">Doenca cardiaca ou pressao alta</option><option value="pregnancy">Gestacao ou amamentacao</option><option value="eating_disorder">Historico de transtorno alimentar</option><option value="medication">Uso de medicamentos que afetam peso/apetite</option><option value="other">Outra condicao - quero informar depois</option></select>;
  }

  if (field === "preferencia alimentar") {
    return (
      <select name={name} className={className} defaultValue="balanced">
        <option value="balanced">Equilibrado - saciedade e prazer</option>
        <option value="satiety">Mais saciedade - volume, fibra e proteina</option>
        <option value="pleasure">Mais prazer - encaixar alimentos gostosos com controle</option>
        <option value="low_meal_volume">Comer menos volume - refeicoes menores e densas</option>
        <option value="simple_repetitive">Simples e repetitivo - praticidade maxima</option>
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
  if (field === "quadril") return "cm. Obrigatorio para mulheres";
  return field;
}
