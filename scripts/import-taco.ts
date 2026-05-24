import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { readFile, utils } from "xlsx";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const workbookPath = process.argv[2] ?? "C:/Users/TB SOLAR/Downloads/Taco-4a-Edicao (1).xlsx";
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type Row = Array<string | number | null>;

async function main() {
  const workbook = readFile(workbookPath);
  const sheet = workbook.Sheets["CMVCol taco3"] ?? workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<Row>(sheet, { header: 1, defval: null, raw: false });
  let category = "TACO";
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const code = String(row[0] ?? "").trim();
    const name = String(row[1] ?? "").trim();

    if (!isFoodCode(code)) {
      if (code && !name && !code.toLowerCase().includes("alimento") && !code.toLowerCase().includes("numero")) {
        category = code;
      }
      continue;
    }

    const kcal = requiredNutrient(row[3]);
    const protein = requiredNutrient(row[5]);
    const fat = requiredNutrient(row[6]);
    const carbs = requiredNutrient(row[8]);

    if (!name) {
      skipped += 1;
      continue;
    }

    await prisma.food.upsert({
      where: { id: tacoId(code) },
      update: {
        name: normalizeWhitespace(name),
        category,
        kcalPer100g: kcal,
        proteinPer100g: protein,
        carbsPer100g: carbs,
        fatPer100g: fat,
        fiberPer100g: parseNutrient(row[9]),
        sodiumPer100g: parseNutrient(row[17]),
        calciumPer100g: parseNutrient(row[11]),
        ironPer100g: parseNutrient(row[16]),
        magnesiumPer100g: parseNutrient(row[12]),
        potassiumPer100g: parseNutrient(row[18]),
        zincPer100g: parseNutrient(row[20]),
        vitaminCPer100g: parseNutrient(row[28]),
        vitaminDPer100g: null,
        vitaminB12Per100g: null,
        source: "TACO 4a edicao",
      },
      create: {
        id: tacoId(code),
        name: normalizeWhitespace(name),
        category,
        kcalPer100g: kcal,
        proteinPer100g: protein,
        carbsPer100g: carbs,
        fatPer100g: fat,
        fiberPer100g: parseNutrient(row[9]),
        sodiumPer100g: parseNutrient(row[17]),
        calciumPer100g: parseNutrient(row[11]),
        ironPer100g: parseNutrient(row[16]),
        magnesiumPer100g: parseNutrient(row[12]),
        potassiumPer100g: parseNutrient(row[18]),
        zincPer100g: parseNutrient(row[20]),
        vitaminCPer100g: parseNutrient(row[28]),
        vitaminDPer100g: null,
        vitaminB12Per100g: null,
        source: "TACO 4a edicao",
      },
    });

    imported += 1;
  }

  console.log(`TACO importada: ${imported} alimentos, ${skipped} linhas ignoradas.`);
}

function isFoodCode(value: string) {
  return /^\d+$/.test(value);
}

function tacoId(code: string) {
  return `taco-${code.padStart(3, "0")}`;
}

function parseNutrient(value: string | number | null) {
  if (value == null) return null;
  const normalized = String(value).trim().replace(",", ".");
  if (!normalized || normalized === "*" || normalized.toUpperCase() === "NA") return null;
  if (normalized.toLowerCase() === "tr") return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function requiredNutrient(value: string | number | null) {
  return parseNutrient(value) ?? 0;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
