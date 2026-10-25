# ShapeOS Mobile Bridge

Este diretorio documenta o contrato para o app iOS do ShapeOS. O site continua sendo o produto principal; o app iOS entra como ponte nativa para:

- ler Apple Health/Apple Watch via HealthKit;
- enviar resumo diario de atividade, sono e batimentos para o backend;
- tirar foto de refeicao e pedir estimativa ao ShapeOS;
- salvar a receita estimada e, se o usuario confirmar, lancar no diario.

## Login mobile

`POST /api/auth/login`

Headers:

```http
Accept: application/json
Content-Type: application/json
```

Body:

```json
{
  "email": "usuario@email.com",
  "password": "senha"
}
```

Resposta:

```json
{
  "token": "shapeos_session_assinado",
  "expiresAt": "2026-06-24T12:00:00.000Z",
  "user": {
    "id": "user_id",
    "name": "Nome",
    "email": "usuario@email.com"
  }
}
```

O app deve guardar o `token` no Keychain e enviar nas proximas chamadas:

```http
Authorization: Bearer shapeos_session_assinado
```

## Perfil e metas

`GET /api/mobile/me`

Retorna usuario, perfil e metricas calculadas para o app renderizar sem duplicar regra de negocio.

## Sincronizar Apple Health

`POST /api/mobile/health/daily`

```json
{
  "date": "2026-05-25",
  "steps": 9300,
  "activeEnergyKcal": 620,
  "restingEnergyKcal": 2100,
  "workoutMinutes": 55,
  "sleepMinutes": 430,
  "restingHeartRateBpm": 58,
  "averageHeartRateBpm": 82,
  "source": "apple_health"
}
```

O backend faz `upsert` por usuario + data. Se o app reenviar o mesmo dia, atualiza.

## Foto de refeição (desativada)

`POST /api/mobile/meal-photo` retorna `410 feature_removed` para uma sessão autenticada (401 sem sessão). Não analisa imagens nem cria receitas ou registros. O cliente deve encaminhar o usuário ao cadastro manual no diário. Estimativas antigas permanecem no banco.

## Coach por regras

`POST /api/coach/briefing` exige sessão e retorna `source: rules`, `briefing` e `insights`, calculados com os registros do próprio usuário. Não aceita contexto externo para substituir os registros e não chama provedores de IA.
