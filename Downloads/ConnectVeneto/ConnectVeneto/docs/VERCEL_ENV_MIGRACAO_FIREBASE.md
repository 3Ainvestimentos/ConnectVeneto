# Migracao completa para projeto Google/Firebase novo (Vercel)

Este documento esta pronto para uso na tabela de variaveis da Vercel.

## 1) Variaveis obrigatorias para o app (Firebase Web)

Use as mesmas variaveis em `Production`, `Preview` e `Development` (a menos que voce queira projetos diferentes por ambiente).

| Variable Name | Value (preencher com projeto novo) | Environments | Sensivel |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `<FIREBASE_WEB_API_KEY>` | Production, Preview, Development | Nao (publica no frontend) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `<PROJECT_ID>.firebaseapp.com` | Production, Preview, Development | Nao |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `<PROJECT_ID>` | Production, Preview, Development | Nao |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `<PROJECT_ID>.firebasestorage.app` (ou `.appspot.com`, conforme console) | Production, Preview, Development | Nao |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `<MESSAGING_SENDER_ID>` | Production, Preview, Development | Nao |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `<APP_ID>` | Production, Preview, Development | Nao |

## 2) Variaveis opcionais (manter se ja usa)

| Variable Name | Value | Environments | Observacao |
|---|---|---|---|
| `FIREBASE_ADMIN_PROJECT_ID` | `<PROJECT_ID_GCP_NOVO>` | Production, Preview, Development | Obrigatorio se usar rotas server-side com Firebase Admin (ex.: billing) |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | `<SERVICE_ACCOUNT_CLIENT_EMAIL>` | Production, Preview, Development | Obrigatorio se usar billing |
| `FIREBASE_ADMIN_PRIVATE_KEY` | `<PRIVATE_KEY_COM_\\n_ESCAPADO>` | Production, Preview, Development | Obrigatorio se usar billing |
| `FERIADOS_API_BASE_URL` | `https://feriadosapi.com` | Production, Preview, Development | Opcional |
| `FERIADOS_API_KEY` | `<FERIADOS_API_KEY>` | Production, Preview, Development | Segredo |

## 3) Bloco .env pronto para copiar

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# opcionais
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
FERIADOS_API_BASE_URL=https://feriadosapi.com
FERIADOS_API_KEY=
```

## 4) Checklist de console Google/Firebase (obrigatorio)

1. Firebase Authentication:
   - Habilitar provider Google.
   - Em `Authorized domains`, incluir:
     - dominio final da Vercel (ou dominio custom de producao),
     - dominios de preview da Vercel,
     - `localhost`.
2. Google Cloud APIs:
   - Ativar `Google Calendar API`.
   - Ativar `Google Drive API`.
3. OAuth Consent Screen:
   - Publicar app (ou adicionar usuarios de teste, se em modo Testing).
   - Adicionar escopos:
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/drive.readonly`

## 5) Restricao de login ao dominio corporativo

Para aceitar apenas contas `@venetomfo.com.br`, aplicar em camadas:

1. **Camada de UX/OAuth**: limitar sugestao de conta no Google para o dominio corporativo.
2. **Camada de seguranca no app**: validar email no backend/contexto antes de liberar sessao.
3. **Camada de autorizacao**: manter controle de colaboradores/permissoes no Firestore.

> Importante: somente configurar dominio na tela de consentimento nao e validacao de seguranca suficiente. A validacao precisa ocorrer no app tambem.

## 6) Observacao tecnica importante (Vercel + Firebase Admin)

O endpoint `src/app/api/billing/route.ts` usa Firebase Admin SDK e, para Vercel, deve usar as variaveis:
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

`GOOGLE_APPLICATION_CREDENTIALS` segue util para ambiente local quando voce usa arquivo json.

## 7) Dados que voce deve me enviar para eu finalizar a migracao tecnica

Envie apenas estes dados (com mascaramento quando necessario):

1. `projectId` do Firebase novo.
2. Config Web App completa (6 campos `NEXT_PUBLIC_FIREBASE_*`).
3. Dominio final de producao na Vercel.
4. Confirmacao se o endpoint de billing sera usado (sim/nao).
5. Confirmacao se devo aplicar bloqueio estrito de dominio `@venetomfo.com.br` no codigo.
