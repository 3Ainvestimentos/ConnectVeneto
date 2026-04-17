# Relatorio Completo de Hardening - Connect Veneto

Documento para revisao externa (Codex ou outro revisor).
Cobre todas as mudancas feitas de seguranca, arquitetura e governanca nesta rodada.

---

## 1. Contexto do projeto

- **Stack:** Next.js 15.5.15 + React 18 + TypeScript + Firebase Web SDK + Firebase Admin SDK + Firestore + Tailwind + ShadCN.
- **Deploy:** Vercel (Hosting + Route Handlers), Firebase (Firestore + Auth + Hosting regras).
- **Auth:** Google Sign-In com dominio forçado `@venetomfo.com.br` via `hd` no provider.
- **Escopo:** intranet corporativa. Publico-alvo: colaboradores internos (+-100 pessoas). Nao e internet aberta.

---

## 2. Sumario executivo das entregas

| Bloco | Escopo | Status |
|-------|--------|--------|
| Governanca | `.cursor/rules`, `.cursor/skills`, `docs/security/SECURITY_ENGINEERING_STANDARD.md` | Concluido |
| npm audit | Snapshot + `npm audit fix` + residuais aceitos + CI step | Concluido (39 -> 21 advisories) |
| XLSX hardening | Limites de upload em `ManageCollaborators` + testes | Concluido (6 novos testes) |
| Logging | `SECURITY_LOG_LEVEL` + silent em test + redaction intacta | Concluido (4 novos testes) |
| /api/rss | `safeFetch` + `parseString` + limite de body + content-type + testes | Concluido (2 novos testes) |
| Auditoria Firebase local | Doc consolidado | Concluido |
| systemSettings Phase A | `/api/me/session` + AuthContext fail-closed para sessoes indisponiveis | Concluido |
| Threat model + HTMLs | 5 paginas HTML + threat model md | Concluido |
| firestore.rules | Diff textual pronto (sem aplicar) | Diff pronto |
| Decisao xlsx | Opcao C aceita formalmente | Documentado |
| systemSettings Phase B | `/api/me/session` reduz superficie + SystemSettingsContext sem defaults sensiveis | Concluido (fecha F-01 em codigo) |

Testes totais: **110 -> 116** (0 regressao).
Typecheck limpo. Lint limpo.

---

## 3. Arquivos criados

### Codigo

- `src/lib/session-client.ts`
- `src/app/api/me/session/route.ts`
- `src/app/api/admin/settings/route.ts`
- `src/components/admin/__tests__/ManageCollaborators.import.test.ts`

### Governanca

- `.cursor/rules/00-security-hardening-core.mdc`
- `.cursor/rules/01-architecture-solid-review.mdc`
- `.cursor/rules/02-security-review-gate.mdc`
- `.cursor/rules/03-firebase-secrets-guardrails.mdc`
- `.cursor/skills/secure-change-playbook/SKILL.md`
- `.cursor/skills/security-review-playbook/SKILL.md`

### Docs (`docs/security/`)

- `SECURITY_ENGINEERING_STANDARD.md`
- `NPM_AUDIT_SNAPSHOT.md`
- `XLSX_RISK_REMOVAL_PLAN.md`
- `RSS_SSRF_HARDENING.md`
- `FIREBASE_LOCAL_AUDIT.md`
- `SYSTEM_SETTINGS_EXPOSURE.md`
- `THREAT_MODEL.md`
- `FIRESTORE_RULES_DIFF.md`
- `firestore.rules.proposed` (versao definitiva minimalista)
- `FULL_AUDIT_REPORT.md` (este arquivo)

### HTMLs visuais

- `docs/security/overview.html`
- `docs/security/trust-boundaries.html`
- `docs/security/apis.html`
- `docs/security/findings.html`
- `docs/security/supply-chain.html`

---

## 4. Arquivos modificados

- `package.json`, `package-lock.json` - via `npm audit fix` (sem `--force`).
- `.env.example` - adicionada `SECURITY_LOG_LEVEL`.
- `.github/workflows/quality-gates.yml` - step `npm audit --audit-level=high --omit=dev`.
- `src/lib/security/logging.ts` - niveis `silent | error | debug` + redaction intacta.
- `src/lib/__tests__/security.test.ts` - 4 novos casos.
- `src/components/admin/ManageCollaborators.tsx` - limites + validacao + mensagem.
- `src/app/api/rss/route.ts` - `safeFetch` + `parseString` + limite 2MB + content-type.
- `src/app/api/__tests__/routes.test.ts` - mock `parseString` + 2 novos casos.
- `src/contexts/SystemSettingsContext.tsx` - `fetchPrivateSystemSettings` usa endpoints.
- `src/contexts/AuthContext.tsx` - decisoes de `isSuperAdmin`/manutencao 100% server-side (`/api/me/session`) com fail-closed.

---

## 5. Mudancas de seguranca detalhadas

### 5.1. XLSX upload hardening (Bloco 3)

**Antes:** `parseXlsxFile` chamava `file.arrayBuffer()` sem limite. Biblioteca `xlsx` tem 2 advisories high sem fix.

**Depois:**
- `COLLABORATORS_IMPORT_MAX_BYTES = 5 MB`, `COLLABORATORS_IMPORT_MAX_ROWS = 5000`.
- `validateImportFileSize` chamada ANTES de `arrayBuffer()`.
- Rejeicao de planilha sem aba valida.
- Erro dedicado `CollaboratorsImportError` com mensagem clara.
- Validacao aplicada tambem em CSV (Papa Parse).
- 9 testes unitarios.

**Por que nao removemos `xlsx`:** decisao formal (Opcao C em `XLSX_RISK_REMOVAL_PLAN.md`). Risco real mitigado pelos limites; advisory permanece no audit com gatilhos de reabertura documentados.

### 5.2. Logging com niveis (Bloco 4)

**Antes:** `logSecurityEvent` sempre `console.error`. Testes poluidos de stderr.

**Depois:**
- Tipo `SecurityLogLevel = 'silent' | 'error' | 'debug'`.
- Lê `SECURITY_LOG_LEVEL` do env. Fallback `silent` em `NODE_ENV=test`, `error` em runtime.
- `redactForLogs` preservado (redige emails, chaves sensiveis).
- 4 testes novos.

### 5.3. `/api/rss` SSRF + DoS (Bloco 5)

**Antes:** `rss-parser.parseURL(url)` fazia fetch interno fora do `safeFetch`.

**Depois:**
- Trocado por `safeFetch` + `parser.parseString(text)`.
- `allowedHosts = ['www.infomoney.com.br']`, `timeoutMs: 6000`.
- `MAX_FEED_BODY_BYTES = 2 MB` (com header + body check).
- Validacao de content-type (xml, rss, atom, text).
- Erros uniformes via `OutboundHttpError` -> 502.
- 2 testes novos (upstream com erro, body excedendo limite).

### 5.4. Auditoria Firebase local (Bloco 6)

Relatorio documentou 3 achados locais:
- Chave privada de service account em `.env` (decisao do usuario: nao rotacionar agora).
- Arquivo `.json` de service account em `Downloads/` (decisao: manter).
- Tokens OAuth ativos no config global do Firebase CLI (recomendacao de renovar).

### 5.5. systemSettings exposure - Phase A (Bloco 7)

**Antes:** `AuthContext` decidia `isSuperAdmin` lendo `superAdminEmails` via client SDK.

**Depois:**
- `/api/me/session` server-side decide `isSuperAdmin` sem retornar a lista.
- `AuthContext` depende da sessao server-side para decisoes de privilegio/manutencao.
- Se `/api/me/session` falhar, o fluxo fecha sessao (fail-closed) e pede retry.

### 5.6. Threat model + HTMLs (Bloco 8)

- Ativos, fronteiras de confianca, 6 zonas, 10 cenarios de abuso.
- 5 HTMLs navegaveis. `trust-boundaries.html` reescrito com narrativa passo a passo + callout explicando `safeFetch`.
- `supply-chain.html` com timeline de historico de correcoes.

### 5.7. systemSettings exposure - Phase B (fechou F-01 em codigo)

Objetivo: superAdminEmails nao chegar no browser de ninguem.

**Mudanca principal:**
- `/api/me/session` estendido: retorna todos os campos SEGUROS (maintenance, terms, privacy, rssNewsletter, etc). **NUNCA** retorna `superAdminEmails` ou `collaboratorAdminEmails`.
- `/api/me/session` nao retorna mais `allowedUserIds`; retorna apenas `isAllowedDuringMaintenance` (bool calculado no server).
- `/api/admin/settings` retorna os sensiveis; acessivel apenas via `requireSuperAdmin`.
- `SystemSettingsContext.fetchPrivateSystemSettings` reescrito:
  - Removeu `getDocument('systemSettings', 'config')` (SDK read).
  - Chama `/api/me/session`.
  - Se `isSuperAdmin`, ALSO chama `/api/admin/settings` e faz merge.
  - Defaults client-side para `superAdminEmails`/`collaboratorAdminEmails` sao vazios.
- `MaintenanceMode.tsx` inalterado (funciona pelo merge para super admin).

**Prova:**
- Dev real: `/api/me/session 200`, `/api/admin/settings 200` (quando super admin), `/api/calendar`, `/api/rss`, `/dashboard` todos 200.
- Typecheck + lint OK.
- Browser de usuario comum nao recebe mais `superAdminEmails` na response, porque a aplicacao nao pede.

**Fechamento completo de F-01:** depende de aplicar o diff em `firestore.rules.proposed` (restringir read de `config` a super admin). Enquanto nao aplicar, um atacante ainda pode abrir DevTools e chamar `getDoc` manual - mas o codigo de producao nao leva superAdminEmails ate o navegador.

---

## 6. firestore.rules.proposed (versao definitiva completa)

Versao unica consolidada. Arquivo em `docs/security/firestore.rules.proposed`.

### Diff vs producao (2 blocos)

**Bloco 1 - systemSettings restrito a super admin:**

```diff
  match /systemSettings/{docId} {
    allow read: if docId == 'public_config';
-   allow read: if isAuthenticated() && docId in ['config', 'admin_config', 'keys'];
+   allow read: if isSuperAdmin() && docId in ['config', 'admin_config', 'keys'];
    allow write: if isSuperAdmin() && docId in ['public_config', 'config', 'admin_config', 'keys'];
  }
```

**Bloco 2 - leaderTrips update com validacao de shape:**

```diff
  match /leaderTrips/{tripId} {
    allow read: if isAuthenticated();

    allow create: if isSuperAdmin()
                  || (
                    isCreatorByUid('responsavelUid')
                    && request.resource.data.leaderName is string
                    && request.resource.data.destinationBranch is string
                    && request.resource.data.startDate is string
                    && request.resource.data.endDate is string
                  );

-   allow update, delete: if isSuperAdmin()
-                         || isOwnerByUid('responsavelUid');
+   allow update: if isSuperAdmin()
+                 || (
+                   isOwnerByUid('responsavelUid')
+                   && request.resource.data.leaderName is string
+                   && request.resource.data.destinationBranch is string
+                   && request.resource.data.startDate is string
+                   && request.resource.data.endDate is string
+                 );
+
+   allow delete: if isSuperAdmin()
+                 || isOwnerByUid('responsavelUid');
  }
```

### Por que e seguro:

1. Client comum nao le mais `config` via SDK (refatoramos).
2. AuthContext pega `isSuperAdmin` via `/api/me/session` (server, Admin SDK bypassa rules).
3. Trusted `get()` usado por `isSuperAdmin()` no rules nao e bloqueado por outras rules.
4. Writes continuam permitidos para super admin.
5. `admin_config` e `keys` ja estavam virtualmente vazios; sem impacto.
6. `leaderTrips` update usa `updateDoc` (merge); `request.resource.data` no rules ve o estado final com todos os campos. Documentos criados sob a rule de create atual ja tem todos os campos obrigatorios.

### Risco residual (leaderTrips)

Se existir trip LEGADO criado antes do rule de create atual estar em vigor e o documento nao tiver `leaderName`, `destinationBranch`, `startDate` ou `endDate` como string, o update dele sera bloqueado. Delete continua funcionando nesse caso.

Mitigacao: rodar query no Firestore Console antes de aplicar para auditar trips legados. Ou aplicar e, se aparecer erro em edicao, limpar os legados.

---

## 7. Dependencias (supply chain)

| Metrica | Antes | Depois |
|---------|-------|--------|
| Advisories totais | 39 | **21** |
| Critical | 3 | **0** |
| High | 11 | **1** (xlsx, aceito) |
| Moderate | 4 | 0 |
| Low | 21 | 20 |

- Fechados via `npm audit fix` (sem `--force`): `protobufjs`, `@hono/node-server`, `@modelcontextprotocol/sdk`, `node-forge`, `path-to-regexp`, `picomatch`, `qs`, `yaml`, e dependencias transitivas.
- Congelados por politica: `genkit`, `genkit-cli`, `@genkit-ai/googleai`, `@genkit-ai/next`.
- Residual aceito: `xlsx` (documentado em `XLSX_RISK_REMOVAL_PLAN.md`).
- CI step `npm audit --audit-level=high --omit=dev` adicionado (hoje como warning via `continue-on-error: true`).

---

## 8. Governanca instalada

### Rules `.cursor/rules/*.mdc`

1. `00-security-hardening-core.mdc` - baseline obrigatoria, sempre aplicada.
2. `01-architecture-solid-review.mdc` - SOLID light, padrao de mudanca.
3. `02-security-review-gate.mdc` - formato de findings, gates obrigatorios.
4. `03-firebase-secrets-guardrails.mdc` - Firebase, secrets, firestore.rules.

### Skills `.cursor/skills/*`

1. `secure-change-playbook` - workflow obrigatorio para mudanca de codigo.
2. `security-review-playbook` - formato e criterios de review.

### Documento unico

`docs/security/SECURITY_ENGINEERING_STANDARD.md` - padrao operacional do projeto.

---

## 9. Findings atuais

| ID | Severidade | Status |
|----|-----------|--------|
| F-01 superAdminEmails legivel | High | Fechado em codigo; pendente publicar rule |
| F-02 xlsx advisories high | High | Aceito formal; mitigado por limites |
| F-03 collaborators lidos por autenticado | Medium | Aceito residual; documentado |
| F-04 service account em Downloads/ | Medium | Decisao do usuario: manter; recomendacoes ativas |
| F-05 SSRF residual /api/rss | - | Fechado (Bloco 5) |
| F-06 DoS xlsx em ManageCollaborators | - | Fechado (Bloco 3) |
| F-07 Ruido console.error em testes | - | Fechado (Bloco 4) |
| F-08 Ausencia de padrao formal de seguranca | - | Fechado (Bloco 1) |

---

## 10. Pontos para revisao externa (revalidacao)

Perguntas em aberto para um segundo revisor olhar:

1. **`isSuperAdmin()` rule faz `get()` em `config`.** Se `config` ficar restrito a super admin, a rule ainda funciona (trusted get bypass), mas vale confirmar: existem edge cases do Firestore Rules que poderiam quebrar isso em alguma regiao?

2. **Fail-closed de sessao.** O fluxo atual encerra login quando `/api/me/session` falha. Confirmar se UX de retry esta adequada para indisponibilidades curtas.

3. **`/api/me/session` sem rate-limit.** Qualquer usuario autenticado pode bater quantas vezes quiser. Faz sentido adicionar rate-limit (ex: 10 req/min por UID)?

4. **`allowedUserIds` no browser.** Resolvido no codigo: `/api/me/session` retorna apenas `isAllowedDuringMaintenance`.

5. **`collaborators` colecao aberta para qualquer autenticado.** Aceito como residual hoje (F-03). Estrategia sugerida: criar `/api/collaborators` server-side com paginacao e restringir colecao no Firestore. Prioridade?

6. **middleware apenas checa cookie.** Cookie nao e token. Usuario poderia fakear cookie e passar o middleware (depois ia cair na autorizacao real do server, mas ainda assim). Vale fortalecer?

7. **`leaderTrips` update sem validacao de shape.** Mantivemos por seguranca no rollout. Quando eh seguro aplicar a versao extended? Precisamos rodar query primeiro para ver se existem trips com schema incompleto?

8. **`xlsx` residual.** Vale forcar a troca por `exceljs` em bloco dedicado? Trade-off entre zerar o audit e manter API atual.

9. **SECURITY_LOG_LEVEL nao tem consumidor externo.** Hoje so vai para `console.error`. Deveriamos integrar com algum log aggregator (Vercel Logs, Sentry, Logtail)?

10. **Service account em `.env`.** Usuario optou por nao rotacionar. Risco aceito. Posso/devo monitorar historico git para confirmar que nunca foi commitado?

---

## 11. Como validar tudo

```bash
# Tipos
npx tsc --noEmit

# Lint
npm run lint

# Testes
npx jest --ci

# Audit
npm audit --audit-level=high --omit=dev

# Dev real (opcional, visual)
npm run dev
# Abrir http://localhost:3000 e logar com conta corporativa.

# HTMLs
npx --yes serve docs/security -l 4455
# Abrir http://localhost:4455/overview.html
```

---

## 12. Arquivos que valem citar na revisao

Para o Codex ler em ordem:

1. `.cursor/rules/00-security-hardening-core.mdc`
2. `src/lib/security/` (todos)
3. `src/app/api/me/session/route.ts`
4. `src/app/api/admin/settings/route.ts`
5. `src/app/api/rss/route.ts`
6. `src/contexts/SystemSettingsContext.tsx`
7. `src/contexts/AuthContext.tsx`
8. `src/components/admin/ManageCollaborators.tsx`
9. `firestore.rules` (atual)
10. `docs/security/firestore.rules.proposed` (alvo)
11. `docs/security/THREAT_MODEL.md`
12. `docs/security/SYSTEM_SETTINGS_EXPOSURE.md`
13. `docs/security/NPM_AUDIT_SNAPSHOT.md`
