---
name: create-migration
description: Cria uma migration nova do banco do ShapeOS (Prisma + PostgreSQL/Supabase) seguindo o padrão do projeto, mantendo schema.prisma e o SQL em sincronia. Use quando o usuário pedir para adicionar/alterar tabela, coluna, índice ou enum.
disable-model-invocation: true
argument-hint: "<o que mudar no banco, ex: adicionar coluna sleep_hours em daily_logs>"
---

# Criar migration do ShapeOS

Pedido: $ARGUMENTS

## Como o projeto faz migrations

- As migrations ficam em `prisma/migrations/<pasta>/migration.sql` (configurado em `prisma.config.ts`).
  A pasta `supabase/migrations` existe mas está vazia: **não** crie nada lá.
- O SQL é **escrito à mão** e aplicado com `npx prisma migrate deploy`. Não rode `prisma migrate dev`
  nem `prisma db push`: eles podem tentar resetar ou alterar o banco de produção do Supabase.
- Nome da pasta: `AAAAMMDD` + número sequencial do dia + `_` + descrição em snake_case em inglês.
  Ex.: `202609211_add_recipe_plan_groups` (21/09/2026, 1ª do dia). Se já existir uma do mesmo dia,
  use o próximo número (`202609212_...`).
- Tabelas e colunas no banco são `snake_case`; no `schema.prisma` os campos são camelCase com
  `@map("...")` e os models têm `@@map("...")`. Siga o que os models vizinhos já fazem.

## Passos

1. Leia `prisma/schema.prisma` e as 2–3 migrations mais recentes (`ls prisma/migrations | tail -3`)
   para copiar o estilo (aspas duplas nos identificadores, nomes de índice `<tabela>_<coluna>_idx`,
   nomes de FK `<tabela>_<coluna>_fkey`).
2. Edite `prisma/schema.prisma` com a mudança.
3. Crie a pasta nova e o `migration.sql` com o SQL equivalente **exato** à mudança do schema.
   - Coluna nova em tabela com dados: deixe opcional ou dê `DEFAULT`, para não quebrar linhas antigas.
   - Toda foreign key nova precisa de um índice na coluna.
   - Use `IF NOT EXISTS` / `IF EXISTS` quando fizer sentido, para a migration poder ser reaplicada.
4. Confira que schema e SQL batem:
   ```bash
   npx prisma validate
   npx prisma generate
   npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script
   ```
   O `migrate diff` deve sair vazio (sem SQL). Se mostrar SQL, a migration ficou faltando algo.
   (Ele precisa de um banco de sombra; se falhar por isso, avise e pule só essa checagem.)
5. Rode `npm test` e `npx tsc --noEmit` para ver se o código que usa o model continua compilando.
6. **Não aplique** a migration no banco. Mostre ao usuário o SQL criado e diga que, para aplicar,
   ele roda `npx prisma migrate deploy` (de preferência primeiro num banco de teste).

## Cuidados

- Nunca apague coluna ou tabela sem o usuário confirmar explicitamente: o banco tem dados de saúde
  de usuários reais.
- Se a mudança envolver RLS ou políticas do Supabase, consulte a skill `supabase-postgres-best-practices`.
