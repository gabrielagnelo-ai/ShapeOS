import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { CoachContext } from "@/lib/coach";
import { generateCoachInsights } from "@/lib/coach";

const coachRequestSchema = z.object({
  userName: z.string().min(1).default("usuário"),
  context: z.object({
    proteinLast3DaysPct: z.array(z.number()).max(3),
    weightStableDays: z.number().min(0),
    adherenceStreakDays: z.number().min(0),
    sleepTrend: z.enum(["up", "stable", "down"]),
    currentDeficitPct: z.number().min(0),
    goal: z.enum(["fat_loss", "maintenance", "muscle_gain"]),
    trainingDoneThisWeek: z.number().min(0),
  }),
});

export type GeminiCoachRequest = z.infer<typeof coachRequestSchema>;

export async function generateGeminiCoachBriefing(input: GeminiCoachRequest) {
  const parsed = coachRequestSchema.parse(input);
  const deterministicInsights = generateCoachInsights(parsed.context as CoachContext);
  const topInsight = deterministicInsights[0]?.message ?? "Mantenha o plano atual e registre suas refeições hoje.";

  if (!process.env.GEMINI_API_KEY) {
    return {
      source: "rules" as const,
      briefing: topInsight,
      insights: deterministicInsights,
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildCoachPrompt(parsed, topInsight),
            },
          ],
        },
      ],
    });

    return {
      source: "gemini" as const,
      briefing: response.text?.trim() || topInsight,
      insights: deterministicInsights,
    };
  } catch {
    return {
      source: "rules" as const,
      briefing: topInsight,
      insights: deterministicInsights,
    };
  }
}

function buildCoachPrompt(input: GeminiCoachRequest, topInsight: string) {
  return [
    "Você e o ShapeOS Coach, um assistente fitness silencioso em portugues do Brasil.",
    "Escreva um unico insight curto, premium, discreto, sem parecer chatbot.",
    "Não diagnostique doenças, não prescreva dieta clínica, não prometa resultados.",
    "Se houver risco médico, recomende procurar profissional de saúde.",
    "Use no maximo 220 caracteres.",
    `Nome: ${input.userName}`,
    `Contexto: ${JSON.stringify(input.context)}`,
    `Insight principal calculado por regras: ${topInsight}`,
  ].join("\n");
}
