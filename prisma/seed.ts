import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required to seed the database.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const foods = [
  ["Arroz branco cozido", "Cereais", 128, 2.5, 28.1, 0.2, 1.6, 1],
  ["Feijao carioca cozido", "Leguminosas", 76, 4.8, 13.6, 0.5, 8.5, 2],
  ["Feijao preto cozido", "Leguminosas", 77, 4.5, 14, 0.5, 8.4, 2],
  ["Peito de frango grelhado", "Carnes", 159, 32, 0, 2.5, 0, 50],
  ["Patinho moido cozido", "Carnes", 219, 35.9, 0, 7.3, 0, 64],
  ["Ovo de galinha inteiro", "Ovos", 143, 13, 1.6, 8.9, 0, 168],
  ["Clara de ovo", "Ovos", 48, 10.9, 0.7, 0.2, 0, 166],
  ["Tilapia grelhada", "Peixes", 129, 26, 0, 2.7, 0, 56],
  ["Sardinha assada", "Peixes", 164, 32.2, 0, 3, 0, 74],
  ["Leite integral", "Laticinios", 61, 3.2, 4.7, 3.3, 0, 64],
  ["Iogurte natural", "Laticinios", 51, 4.1, 1.9, 3, 0, 52],
  ["Queijo minas frescal", "Laticinios", 264, 17.4, 3.2, 20.2, 0, 31],
  ["Aveia em flocos", "Cereais", 394, 13.9, 66.6, 8.5, 9.1, 5],
  ["Pao frances", "Panificados", 300, 8, 58.6, 3.1, 2.3, 648],
  ["Batata doce cozida", "Tuberculos", 77, 0.6, 18.4, 0.1, 2.2, 3],
  ["Mandioca cozida", "Tuberculos", 125, 0.6, 30.1, 0.3, 1.6, 1],
  ["Macarrao cozido", "Massas", 158, 5.8, 30.9, 0.9, 1.8, 1],
  ["Banana prata", "Frutas", 98, 1.3, 26, 0.1, 2, 0],
  ["Maca", "Frutas", 56, 0.3, 15.2, 0, 1.3, 0],
  ["Mamao formosa", "Frutas", 45, 0.8, 11.6, 0.1, 1.8, 2],
  ["Laranja pera", "Frutas", 37, 1, 8.9, 0.1, 1.8, 0],
  ["Abacate", "Frutas", 96, 1.2, 6, 8.4, 6.3, 0],
  ["Brocolis cozido", "Verduras", 25, 2.1, 4.4, 0.5, 3.4, 2],
  ["Alface crespa", "Verduras", 11, 1.3, 1.7, 0.2, 1.8, 3],
  ["Tomate", "Verduras", 15, 1.1, 3.1, 0.2, 1.2, 1],
  ["Cenoura cozida", "Legumes", 30, 0.8, 6.7, 0.2, 2.6, 8],
  ["Azeite de oliva", "Oleos", 884, 0, 0, 100, 0, 0],
  ["Amendoim torrado", "Oleaginosas", 606, 22.5, 18.7, 54, 7.8, 376],
  ["Castanha de caju", "Oleaginosas", 570, 18.5, 29.1, 46.3, 3.7, 125],
  ["Whey protein", "Suplementos", 400, 80, 8, 6, 0, 200],
  ["Acucar cristal", "Acucares", 387, 0.3, 99.6, 0, 0, 0],
  ["Cafe sem acucar", "Bebidas", 2, 0.1, 0, 0, 0, 1],
] as const;

async function main() {
  for (const [name, category, kcal, protein, carbs, fat, fiber, sodium] of foods) {
    await prisma.food.upsert({
      where: { id: name.toLowerCase().replaceAll(" ", "-") },
      update: {},
      create: {
        id: name.toLowerCase().replaceAll(" ", "-"),
        name,
        category,
        kcalPer100g: kcal,
        proteinPer100g: protein,
        carbsPer100g: carbs,
        fatPer100g: fat,
        fiberPer100g: fiber,
        sodiumPer100g: sodium,
        source: "Seed ShapeOS compatível com TACO 4a edicao",
      },
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
