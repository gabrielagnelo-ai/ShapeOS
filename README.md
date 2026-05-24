# ShapeOS

MVP fitness premium em portugues do Brasil, inspirado em Apple Health/Fitness e iOS widgets. O app calcula BMR, TDEE, IMC, percentual de gordura estimado, metas de macros, sugestoes de dieta, acompanhamento semanal e insights contextuais do ShapeOS Coach.

## Stack

- Next.js + TypeScript
- TailwindCSS
- PostgreSQL + Prisma ORM
- Zod
- Auth base com email/senha e bcrypt
- Vitest para testes unitarios

## Rodando localmente

```bash
npm install
npm run prisma:generate
npm run dev
```

Abra `http://localhost:3000`.

Para Supabase, copie as strings em Project Settings > Database. Use a connection string Postgres, nao a API key do projeto:

```bash
npm run prisma:generate
npm run prisma:seed
```

Para criar as tabelas no banco:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

## Rotas

- `/` landing page
- `/onboarding` cadastro inicial e selecao de modo guiado/avancado
- `/dashboard` tela Hoje com briefing, macros, refeicoes e Coach
- `/calculadoras` BMR, TDEE, IMC, gordura estimada e meta calorica
- `/alimentos` estrutura TACO e amostra de alimentos
- `/dieta` montador de dieta, trocas, fixos, bloqueios e compras
- `/diario` consumo real vs meta
- `/acompanhamento` check-in semanal e ajuste automatico
- `/coach` engine de insights
- `/receitas` receitas com macros por porcao

## Arquitetura

- `prisma/schema.prisma`: schema completo do MVP
- `prisma/seed.ts`: seed com mais de 30 alimentos brasileiros comuns
- `src/lib/nutrition`: funcoes puras para calculos, macros, nutrientes e ajustes
- `src/lib/coach`: triggers, insights, briefing diario e consistency score
- `src/lib/validations.ts`: schemas Zod
- `src/components`: UI reutilizavel em estilo iOS/glass

## TACO

A tabela `food` foi modelada para compatibilidade com TACO 4a edicao:

- `id`
- `name`
- `category`
- `kcal_per_100g`
- `protein_per_100g`
- `carbs_per_100g`
- `fat_per_100g`
- `fiber_per_100g`
- `sodium_per_100g`
- `source`
- `created_at`

O arquivo Excel da TACO pode ser convertido futuramente para CSV e importado mapeando cada coluna nutricional para os campos por 100g.

## Testes

```bash
npm test
npm run lint
npm run build
```

Cobertura inicial:

- BMR
- TDEE
- IMC
- macros
- ajustes automaticos
- triggers do Coach

## Segurança e etica

O ShapeOS nao diagnostica doencas, nao prescreve dieta clinica e nao promete resultados. Usuarios com diabetes, doenca renal, gestacao, transtornos alimentares, doenca cardiaca ou uso de medicamentos devem procurar medico ou nutricionista.
