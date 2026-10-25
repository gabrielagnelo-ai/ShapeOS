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

## Intro ShapeOS

A abertura é montada uma vez no layout raiz (`src/app/layout.tsx`), sem alterar
as páginas existentes. O conteúdo permanece renderizado/carregando por trás.

- `src/components/brand/shapeos-intro.tsx`: ciclo de vida, anéis e voo do símbolo.
- `src/components/brand/shapeos-intro.module.css`: anéis em 3D e tempos da abertura.
- `src/components/brand/shapeos-intro.config.ts`: asset, tempos e bootstrap inicial.
- `public/shapeos-mark.png`: o símbolo, o mesmo da barra do topo.

Anéis em órbita (DS-27 no vault): os quatro anéis de Hoje chegam girando em
profundidade, se assentam de frente e fecham em volta do símbolo. A cerca de
1,3 s o símbolo voa até o logo da barra, enquanto os anéis recuam e a página
abre. Tudo é CSS e Web Animations e começa na primeira pintura.

Para testar, abra `/?intro=replay`. Para ignorar, use `/?intro=off`.
Para desativar globalmente, defina `NEXT_PUBLIC_SHAPEOS_INTRO=false` em
`.env.local` e reinicie o servidor (refaça o build em produção).
O parâmetro de replay respeita a desativação global e `prefers-reduced-motion`.
A chave `shapeos:intro:seen` em `sessionStorage` evita repetição, inclusive em
navegações que recarregam a página. Se storage não estiver disponível, a página
continua funcionando; a persistência entre reloads depende do navegador.

Escape, Tab ou um toque/clique encerram a intro. Movimento reduzido pula a
sequência. Sem JavaScript, o site aparece diretamente. Falha da imagem libera
o site, com espera máxima de 1 s para seu carregamento após a hidratação; um
timeout independente de 4,5 s também libera a tela se a hidratação falhar.
Não foram adicionadas dependências. A animação usa CSS; os timers JavaScript
controlam apenas início, encerramento e contingências.

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
