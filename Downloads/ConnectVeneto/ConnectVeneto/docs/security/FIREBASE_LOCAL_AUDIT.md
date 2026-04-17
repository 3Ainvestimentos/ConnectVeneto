# Auditoria Local Firebase - Connect Veneto

Relatorio focado na trilha do projeto `veneto-connect`, separando
o que foi confirmado localmente do que foi inferido do codigo e do que
ainda precisa de evidencia adicional.

Referencia: regras `.cursor/rules/03-firebase-secrets-guardrails.mdc`.

---

## 1. Confirmado localmente

### 1.1. Mapeamento do projeto no Firebase CLI

Arquivo: `C:\Users\Henrique Peixoto\.config\configstore\firebase-tools.json`

- `activeProjects` contem a entrada:
  - `C:\Users\Henrique Peixoto\Downloads\ConnectVeneto\ConnectVeneto` => `veneto-connect`
- Usuario autenticado no Firebase CLI:
  - `desenvolvedor@venetomfo.com.br`
  - hd `venetomfo.com.br`
- Tokens OAuth persistidos no mesmo arquivo (`access_token`, `refresh_token`, `id_token`).

**Risco:** tokens OAuth em arquivo local sem rotacao. Se a maquina for comprometida, atacante
tem acesso direto ao projeto `veneto-connect` via `firebase` CLI.

**Recomendacao:**
- Rodar `firebase logout` e `firebase login` periodicamente para renovar.
- Considerar `firebase login --reauth` antes de deploys sensiveis.
- Nunca compartilhar esse arquivo.

### 1.2. Credenciais no `.env` do projeto

Arquivo: `.env` na raiz do repositorio (ignorado por `.gitignore`).

Contem:
- `NEXT_PUBLIC_FIREBASE_*` (config web, publico por natureza)
- `CALENDAR_PUBLIC_ID`, `GOOGLE_CALENDAR_API_KEY`
- `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY` (chave privada do service account, PEM com `\n` escapado)

**Risco:** a chave privada do service account esta presente em texto claro no disco.
Qualquer processo com acesso ao usuario consegue ler.

**Recomendacao:**
- Confirmar que o `.env` **nunca** foi commitado (checar `git log --all --full-history -- .env`).
- Rotacionar a chave privada no console GCP:
  - IAM & Admin -> Service Accounts -> `firebase-adminsdk-fbsvc@veneto-connect.iam.gserviceaccount.com`
  - Revogar a chave atual apos substituir.
- Para producao, usar **apenas** variaveis de ambiente da Vercel, nunca arquivo local.

### 1.3. Service account em `Downloads/`

Arquivo: `C:\Users\Henrique Peixoto\Downloads\veneto-connect-firebase-adminsdk-fbsvc-2a39cf27a0.json`

- Service account key em JSON, fora do repositorio.
- Mesma chave usada no `.env` (nome `firebase-adminsdk-fbsvc`).

**Risco:** arquivo em `Downloads/` facilita exposicao acidental
(upload para chat, anexo em email, scan de seguranca que varre pasta).

**Recomendacao:**
- Mover para `~/.config/veneto/` ou cofre de senha (1Password, Bitwarden, KeePass).
- Ideal: excluir apos importar no Vercel e usar apenas via env da Vercel.
- Rodar busca rapida para confirmar que nao ha copias espalhadas:
  - `Get-ChildItem -Path C:\Users\Henrique Peixoto -Recurse -Filter "*firebase-adminsdk*" -ErrorAction SilentlyContinue`

### 1.4. `.gitignore` ativo

- `.env*` esta ignorado.
- `firebase-debug.log` e `firestore-debug.log` ignorados.
- `/node_modules`, `/.next` ignorados.

Nenhum risco local detectado no `.gitignore`.

---

## 2. Inferido do codigo

### 2.1. Contratos de autenticacao server-side

- `src/lib/api-auth.ts` confirma que apenas tokens ID de `@venetomfo.com.br`
  autenticam via `verifyCorporateRequest`.
- `src/lib/security/auth.ts` confirma que `requireSuperAdmin` le
  `systemSettings/config.superAdminEmails` no servidor.

Inferencia: rotas `/api/*` protegidas dependem de:
- `FIREBASE_ADMIN_*` corretamente configurado.
- Documento `systemSettings/config` existente no Firestore.

Se qualquer um dos dois estiver ausente, `requireSuperAdmin` falha
com `SYSTEM_SETTINGS_NOT_FOUND` e o endpoint retorna 503.

### 2.2. Firebase Admin initialization

`src/lib/firebase-admin.ts`:

- Usa `FIREBASE_ADMIN_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` (Vercel/local).
- Fallback silencioso para `GOOGLE_APPLICATION_CREDENTIALS` com warning.
- Nao escreve credenciais em log.

Inferencia: configuracao de producao deve usar exclusivamente as tres variaveis
acima. Nao ha dependencia de arquivo JSON em producao.

### 2.3. Firebase Web initialization

`src/lib/firebase.ts`:

- Usa `NEXT_PUBLIC_FIREBASE_*`.
- Comporta-se como singleton.
- Apenas valores publicos (todos `NEXT_PUBLIC_`).

Inferencia: nenhum segredo vaza via este arquivo para o client.

### 2.4. Publicacao de Firestore rules

- Script atual em `functions/package.json` deploy functions.
- Nenhum script automatico publica `firestore.rules`.
- Publicacao e sempre manual: `firebase deploy --only firestore:rules`.

Inferencia: rules so mudam com acao humana intencional. Bom para seguranca,
mas exige checklist manual (atendido pela rule `03-firebase-secrets-guardrails`).

### 2.5. Uso da camada `@/lib/security`

Rotas que passam por `requireCorporateUser` ou `requireSuperAdmin`:
- `src/app/api/billing/route.ts` (super admin)
- `src/app/api/calendar/route.ts` (usuario corporativo)
- `src/app/api/holidays/route.ts` (usuario corporativo)
- `src/app/api/rss/route.ts` (usuario corporativo)

Inferencia: nao ha rota `/api/*` sem autorizacao server-side no projeto atual.

---

## 3. Pendente de evidencia

### 3.1. Confirmar nao-commit do `.env`

- Nao foi rodado `git log --all --full-history -- .env` dentro deste escopo.
- Recomendacao: rodar manualmente e, se houver commit historico, fazer rotacao imediata
  (a chave privada pode estar no historico do repositorio).

### 3.2. Publicacao atual de `firestore.rules`

- O arquivo local `firestore.rules` pode divergir do publicado no projeto `veneto-connect`.
- Nao executamos `firebase firestore:rules get` neste escopo.
- Recomendacao: validar se o publicado bate com o arquivo, especialmente antes de
  considerar o Parcial 9 (diff textual).

### 3.3. Restricoes da API Key da Google

- `GOOGLE_CALENDAR_API_KEY` e `NEXT_PUBLIC_FIREBASE_API_KEY` estao no `.env`.
- Nao foi verificado se possuem restricoes de API no GCP.
- Recomendacao:
  - `GOOGLE_CALENDAR_API_KEY`: restrita a Google Calendar API, sem restricao de site HTTP.
  - `NEXT_PUBLIC_FIREBASE_API_KEY`: pode ter restricao de site HTTP para dominios Vercel.

### 3.4. Service accounts adicionais no projeto

- Nao inspecionamos GCP Console para listar todos os service accounts de `veneto-connect`.
- Recomendacao manual: garantir que apenas um service account ativo tenha permissao
  de Admin. Remover os nao utilizados.

### 3.5. Auditoria de acesso no Firestore

- `firestore.rules` atual permite `read` de `systemSettings/config`, `/admin_config`, `/keys`
  para qualquer autenticado.
- Nao checamos se esses documentos tem dados sensiveis alem de `superAdminEmails`.
- Recomendacao: acao formal no Parcial 7.

---

## 4. Acoes imediatas recomendadas

| Prioridade | Acao |
|-----------|------|
| Alta | Rotacionar chave privada do service account `firebase-adminsdk-fbsvc` |
| Alta | Confirmar historico git sem commit de `.env` |
| Alta | Mover service account `.json` de `Downloads/` para pasta segura ou excluir |
| Media | Rodar `firebase logout && firebase login` para renovar tokens OAuth do CLI |
| Media | Validar restricoes de API key no GCP |
| Baixa | Listar e limpar service accounts nao utilizados em `veneto-connect` |

---

## 5. Status

- Confirmado: 4 achados (mapeamento, `.env`, SA em Downloads, `.gitignore`).
- Inferido: 5 blocos de conformidade com o codigo atual.
- Pendente: 5 checagens manuais recomendadas.

Este documento deve ser revisitado apos rotacao de credenciais e alteracao em `firestore.rules`.
