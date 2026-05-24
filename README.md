# ShapeOS

MVP fitness premium em português do Brasil, inspirado em Apple Health/Fitness e iOS widgets. O app calcula BMR, TDEE, IMC, percentual de gordura estimado, metas de macros, sugestões de dieta, acompanhamento semanal e insights contextuais do ShapeOS Coach.

## Stack

- Next.js + TypeScript
- TailwindCSS
- PostgreSQL + Prisma ORM
- Zod
- Auth base com email/senha e bcrypt
- Vitest para testes unitários

## Rodando localmente

```bash
npm install
npm run prisma:generate
npm run dev
```

Abra `http://localhost:3000`.

Para Supabase, copie as strings em Project Settings > Database. Use a connection string Postgres, não a API key do projeto:

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
- `/onboarding` cadastro inicial e seleção de modo guiado/avançado
- `/dashboard` tela Hoje com briefing, macros, refeições e Coach
- `/calculadoras` BMR, TDEE, IMC, gordura estimada e meta calórica
- `/alimentos` estrutura TACO e amostra de alimentos
- `/dieta` montador de dieta, trocas, fixos, bloqueios e compras
- `/diario` consumo real vs meta
- `/acompanhamento` check-in semanal e ajuste automático
- `/coach` engine de insights
- `/receitas` receitas com macros por porção

## Arquitetura

- `prisma/schema.prisma`: schema completo do MVP
- `prisma/seed.ts`: seed com mais de 30 alimentos brasileiros comuns
- `src/lib/nutrition`: funções puras para cálculos, macros, nutrientes e ajustes
- `src/lib/coach`: triggers, insights, briefing diário e consistency score
- `src/lib/validations.ts`: schemas Zod
- `src/components`: UI reutilizável em estilo iOS/glass

## TACO

A tabela `food` foi modelada para compatibilidade com TACO 4a edição:

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
- ajustes automáticos
- triggers do Coach

## Segurança e ética

O ShapeOS não diagnostica doenças, não prescreve dieta clínica e não promete resultados. Usuários com diabetes, doença renal, gestação, transtornos alimentares, doença cardíaca ou uso de medicamentos devem procurar médico ou nutricionista.
