import type { Sex } from "@/lib/nutrition";

// Circunferências opcionais que alimentam o modelo corporal (além de pescoço, cintura e quadril,
// que seguem obrigatórios para o BF pelo método da Marinha).
export const CIRCUMFERENCE_FIELDS = [
  { key: "chestCm", label: { male: "Peito", female: "Busto" }, help: "Na linha dos mamilos, com os braços relaxados.", placeholder: "Ex: 102", min: 50, max: 200 },
  { key: "armCm", label: { male: "Braço", female: "Braço" }, help: "No meio do braço, entre ombro e cotovelo, relaxado.", placeholder: "Ex: 36", min: 15, max: 70 },
  { key: "thighCm", label: { male: "Coxa", female: "Coxa" }, help: "No meio da coxa, entre a virilha e o joelho.", placeholder: "Ex: 58", min: 30, max: 110 },
  { key: "calfCm", label: { male: "Panturrilha", female: "Panturrilha" }, help: "Na parte mais larga da panturrilha.", placeholder: "Ex: 38", min: 20, max: 70 },
] as const;

export type CircumferenceKey = (typeof CIRCUMFERENCE_FIELDS)[number]["key"];
export type Circumferences = Record<CircumferenceKey, number | null>;

export function circumferenceLabel(key: CircumferenceKey, sex: Sex) {
  return CIRCUMFERENCE_FIELDS.find((field) => field.key === key)!.label[sex];
}

// Lê os campos de um formulário. Vazio ou fora da faixa plausível vira null (medida não informada).
export function parseCircumferences(form: Pick<FormData, "get">): Circumferences {
  return Object.fromEntries(
    CIRCUMFERENCE_FIELDS.map(({ key, min, max }) => {
      const raw = form.get(key);
      if (raw === null || String(raw).trim() === "") return [key, null];
      const value = Number(String(raw).replace(",", "."));
      return [key, Number.isFinite(value) && value >= min && value <= max ? value : null];
    }),
  ) as Circumferences;
}

// Medida mais recente conhecida: o primeiro registro (do mais novo ao mais antigo) que tenha o valor,
// senão o valor do perfil. Assim um check-in sem braço não apaga o último braço medido.
export function latestCircumferences(
  profile: Partial<Circumferences>,
  snapshots: Partial<Circumferences>[],
): Circumferences {
  return Object.fromEntries(
    CIRCUMFERENCE_FIELDS.map(({ key }) => [key, snapshots.find((snapshot) => snapshot[key] != null)?.[key] ?? profile[key] ?? null]),
  ) as Circumferences;
}
