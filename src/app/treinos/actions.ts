"use server";

import { GoogleGenAI } from "@google/genai";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_TRAINING_PDF_BYTES = 8 * 1024 * 1024;

type AiTrainingPlan = {
  name: string;
  notes?: string;
  days: Array<{
    name: string;
    focus?: string;
    notes?: string;
    exercises: Array<{
      name: string;
      muscleGroup?: string;
      sets?: string;
      reps?: string;
      restSeconds?: number | null;
      loadInstruction?: string;
      notes?: string;
    }>;
  }>;
};

export async function importTrainingPdfAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const file = formData.get("trainingPdf");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.type !== "application/pdf" || file.size > MAX_TRAINING_PDF_BYTES) return;

  const bytes = Buffer.from(await file.arrayBuffer());
  const parsed = process.env.GEMINI_API_KEY
    ? await parseTrainingPdfWithGemini({ fileName: file.name, bytes })
    : fallbackTrainingPlan(file.name);

  await prisma.trainingPlan.updateMany({
    where: { userId: user.id, isActive: true },
    data: { isActive: false },
  });

  await prisma.trainingPlan.create({
    data: {
      userId: user.id,
      name: parsed.name || file.name.replace(/\.pdf$/i, "") || "Treino importado",
      sourceFileName: file.name,
      sourceMimeType: file.type,
      sourceData: bytes,
      rawResult: parsed,
      notes: parsed.notes ?? "Treino importado por PDF. Confira exercicios, series e repeticoes antes de usar como referencia fixa.",
      isActive: true,
      days: {
        create: parsed.days.map((day, dayIndex) => ({
          name: day.name || `Dia ${dayIndex + 1}`,
          focus: day.focus ?? null,
          notes: day.notes ?? null,
          order: dayIndex,
          exercises: {
            create: day.exercises.map((exercise, exerciseIndex) => ({
              name: exercise.name || "Exercicio nao identificado",
              muscleGroup: exercise.muscleGroup ?? null,
              sets: exercise.sets ?? null,
              reps: exercise.reps ?? null,
              restSeconds: normalizeRest(exercise.restSeconds),
              loadInstruction: exercise.loadInstruction ?? null,
              notes: exercise.notes ?? null,
              order: exerciseIndex,
            })),
          },
        })),
      },
    },
  });

  revalidatePath("/treinos");
  revalidatePath("/dashboard");
  revalidatePath("/coach");
  revalidatePath("/relatorio-nutricionista");
}

export async function deleteTrainingPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const planId = String(formData.get("planId") ?? "");
  if (!planId) return;

  await prisma.trainingPlan.deleteMany({ where: { id: planId, userId: user.id } });
  revalidatePath("/treinos");
  revalidatePath("/dashboard");
  revalidatePath("/coach");
  revalidatePath("/relatorio-nutricionista");
}

export async function setActiveTrainingPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const planId = String(formData.get("planId") ?? "");
  if (!planId) return;

  const plan = await prisma.trainingPlan.findFirst({ where: { id: planId, userId: user.id }, select: { id: true } });
  if (!plan) return;

  await prisma.$transaction([
    prisma.trainingPlan.updateMany({ where: { userId: user.id }, data: { isActive: false } }),
    prisma.trainingPlan.update({ where: { id: plan.id }, data: { isActive: true } }),
  ]);

  revalidatePath("/treinos");
  revalidatePath("/dashboard");
  revalidatePath("/coach");
  revalidatePath("/relatorio-nutricionista");
}

async function parseTrainingPdfWithGemini(input: { fileName: string; bytes: Buffer }): Promise<AiTrainingPlan> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          {
            text: [
              "Voce e o parser de treinos do ShapeOS em portugues do Brasil.",
              "Leia o PDF e converta em JSON valido, sem markdown.",
              "Formato exato: {\"name\":\"nome do plano\",\"notes\":\"observacao curta\",\"days\":[{\"name\":\"Dia A\",\"focus\":\"Peito e triceps\",\"notes\":\"opcional\",\"exercises\":[{\"name\":\"Supino reto\",\"muscleGroup\":\"peito\",\"sets\":\"4\",\"reps\":\"8-10\",\"restSeconds\":90,\"loadInstruction\":\"RIR 1-2\",\"notes\":\"opcional\"}]}]}",
              "Se alguma informacao nao existir, use null ou string vazia. Nao invente cargas.",
              "Preserve nomes de exercicios, series, repeticoes, descanso, observacoes e cardio quando aparecerem.",
              "Se o PDF estiver pouco legivel, extraia o melhor possivel e avise em notes.",
              `Nome do arquivo: ${input.fileName}`,
            ].join("\n"),
          },
          { inlineData: { mimeType: "application/pdf", data: input.bytes.toString("base64") } },
        ],
      }],
    });

    return sanitizeTrainingPlan(parseTrainingPlan(response.text ?? "") ?? fallbackTrainingPlan(input.fileName));
  } catch {
    return fallbackTrainingPlan(input.fileName);
  }
}

function parseTrainingPlan(text: string): AiTrainingPlan | null {
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as AiTrainingPlan;
    if (!parsed.name || !Array.isArray(parsed.days)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sanitizeTrainingPlan(plan: AiTrainingPlan): AiTrainingPlan {
  const days = plan.days
    .filter((day) => day && Array.isArray(day.exercises))
    .slice(0, 10)
    .map((day, index) => ({
      name: String(day.name || `Dia ${index + 1}`).slice(0, 80),
      focus: day.focus ? String(day.focus).slice(0, 120) : undefined,
      notes: day.notes ? String(day.notes).slice(0, 500) : undefined,
      exercises: day.exercises.slice(0, 20).map((exercise) => ({
        name: String(exercise.name || "Exercicio").slice(0, 120),
        muscleGroup: exercise.muscleGroup ? String(exercise.muscleGroup).slice(0, 80) : undefined,
        sets: exercise.sets ? String(exercise.sets).slice(0, 40) : undefined,
        reps: exercise.reps ? String(exercise.reps).slice(0, 40) : undefined,
        restSeconds: normalizeRest(exercise.restSeconds),
        loadInstruction: exercise.loadInstruction ? String(exercise.loadInstruction).slice(0, 120) : undefined,
        notes: exercise.notes ? String(exercise.notes).slice(0, 240) : undefined,
      })),
    }));

  return {
    name: String(plan.name || "Treino importado").slice(0, 100),
    notes: plan.notes ? String(plan.notes).slice(0, 800) : undefined,
    days: days.length ? days : fallbackTrainingPlan(plan.name).days,
  };
}

function fallbackTrainingPlan(fileName: string): AiTrainingPlan {
  return {
    name: fileName.replace(/\.pdf$/i, "") || "Treino importado",
    notes: "Nao foi possivel interpretar completamente o PDF. O arquivo foi salvo; revise o conteudo manualmente.",
    days: [
      {
        name: "Treino importado",
        focus: "Revisar PDF",
        exercises: [
          {
            name: "PDF anexado para revisao",
            notes: "Reimporte com um PDF mais legivel se a IA nao extrair exercicios.",
          },
        ],
      },
    ],
  };
}

function normalizeRest(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}
