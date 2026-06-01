"use server";

import { GoogleGenAI } from "@google/genai";
import { PDFParse } from "pdf-parse";
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
  const extractedText = await extractPdfText(bytes);
  const parsed = process.env.GEMINI_API_KEY
    ? await parseTrainingPdfWithGemini({ fileName: file.name, bytes, extractedText })
    : parseTrainingFromText(file.name, extractedText) ?? fallbackTrainingPlan(file.name);

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

async function parseTrainingPdfWithGemini(input: { fileName: string; bytes: Buffer; extractedText: string }): Promise<AiTrainingPlan> {
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
              `Texto extraido do PDF, use como fonte principal quando existir:\n${input.extractedText.slice(0, 14000) || "sem texto extraido"}`,
            ].join("\n"),
          },
          { inlineData: { mimeType: "application/pdf", data: input.bytes.toString("base64") } },
        ],
      }],
    });

    return sanitizeTrainingPlan(parseTrainingPlan(response.text ?? "") ?? parseTrainingFromText(input.fileName, input.extractedText) ?? fallbackTrainingPlan(input.fileName));
  } catch {
    return parseTrainingFromText(input.fileName, input.extractedText) ?? fallbackTrainingPlan(input.fileName);
  }
}

async function extractPdfText(bytes: Buffer) {
  try {
    const parser = new PDFParse({ data: bytes });
    const result = await parser.getText();
    await parser.destroy();
    return result.text.replace(/\r/g, "").trim();
  } catch {
    return "";
  }
}

function parseTrainingFromText(fileName: string, text: string): AiTrainingPlan | null {
  const lines = text
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const dayIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\b/i.test(line));
  if (!dayIndexes.length) return null;

  const days = dayIndexes.map(({ line, index }, dayIndex) => {
    const nextIndex = dayIndexes[dayIndex + 1]?.index ?? lines.length;
    const block = lines.slice(index + 1, nextIndex);
    const { name, focus } = parseDayHeading(line);
    const exercises = parseExerciseBlock(block);

    return {
      name,
      focus,
      exercises: exercises.length ? exercises : [{ name: "Revisar bloco do PDF", notes: block.join(" ").slice(0, 240) }],
    };
  }).filter((day) => !/descanso/i.test(day.name) && !/descanso/i.test(day.focus ?? ""));

  if (!days.length) return null;

  return sanitizeTrainingPlan({
    name: lines[0] && !/^(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\b/i.test(lines[0])
      ? lines[0]
      : fileName.replace(/\.pdf$/i, ""),
    notes: "Plano extraido do texto do PDF. Revise series, repeticoes e RPE antes de usar como oficial.",
    days,
  });
}

function parseDayHeading(line: string) {
  const [rawDay, ...rest] = line.split(/[–-]/);
  const detail = rest.join("-").trim();
  const name = `${capitalize(rawDay.trim())}${detail ? ` - ${detail.replace(/\s*\([^)]*\)\s*/g, "").trim()}` : ""}`.slice(0, 80);
  const focus = (line.match(/\(([^)]*)\)/)?.[1] ?? detail).trim();
  return { name, focus };
}

function parseExerciseBlock(lines: string[]) {
  const exercises: AiTrainingPlan["days"][number]["exercises"] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^\d+\.\s*(.+)$/);
    if (!match) {
      if (exercises.length) {
        const previous = exercises[exercises.length - 1];
        previous.notes = [previous.notes, line].filter(Boolean).join(" ");
      }
      continue;
    }

    const raw = match[1].trim();
    const parts = raw.split("|").map((part) => part.trim()).filter(Boolean);
    const first = parts[0] ?? raw;
    const nameMatch = first.match(/^(.+?)\s+[–-]?\s*(\d+(?:[–-]\d+)?x)\b/i);
    const sets = nameMatch?.[2] ?? first.match(/\b(\d+(?:[–-]\d+)?x)\b/i)?.[1];
    const name = (nameMatch?.[1] ?? first.replace(/\b\d+(?:[–-]\d+)?x\b/i, "")).replace(/[–-]\s*$/, "").trim();
    const reps = parts.find((part) => /\d+\s*[–-]\s*\d+|\d+\+?/.test(part) && !/rpe/i.test(part) && !/^\d+(?:[–-]\d+)?x$/i.test(part));
    const rpe = parts.find((part) => /rpe/i.test(part));

    exercises.push({
      name: name || raw,
      muscleGroup: inferMuscleGroup(name || raw),
      sets,
      reps,
      loadInstruction: rpe,
    });
  }

  return exercises;
}

function inferMuscleGroup(name: string) {
  const value = name.toLowerCase();
  if (/pulley|remada|barra|puxada/.test(value)) return "costas";
  if (/rosca|wrist/.test(value)) return "biceps/antebraco";
  if (/supino|crucifixo/.test(value)) return "peito";
  if (/triceps|tríceps/.test(value)) return "triceps";
  if (/elevação|elevacao|ombro/.test(value)) return "ombro";
  if (/panturrilha/.test(value)) return "panturrilha";
  if (/agachamento|hack|leg|extensora/.test(value)) return "quadriceps";
  if (/stiff|flexora/.test(value)) return "posterior";
  if (/crunch|abdominal/.test(value)) return "abdomen";
  return undefined;
}

function capitalize(value: string) {
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
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
