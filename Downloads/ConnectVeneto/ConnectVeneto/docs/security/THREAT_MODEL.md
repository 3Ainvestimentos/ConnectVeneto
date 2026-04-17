# Threat Model - Connect Veneto

Modelagem de ameacas focada em cenarios realistas e com evidencia no codigo atual.

---

## 1. Ativos criticos

| Ativo | Descricao | Sensibilidade |
|-------|-----------|---------------|
| Base de colaboradores | Dados pessoais (nome, email, cargo, cidade, lideranca) | Alta |
| `systemSettings/config` | Campos administrativos incluindo `superAdminEmails` | Alta |
| Credenciais Admin SDK | `FIREBASE_ADMIN_PRIVATE_KEY`, service account JSON | Critica |
| Token de sessao Firebase | Usado em rotas `/api/*` autenticadas | Alta |
| Logs de auditoria (`audit_logs`) | Historico de acoes de usuarios | Media |
| Conteudo publico agregado (RSS, calendar) | Baixa sensibilidade individual | Baixa |
| Token OAuth Google do Calendar | Acesso leitura a agenda publica | Baixa |

---

## 2. Fronteiras de confianca

1. **Publico -> App Next.js:** qualquer pessoa pode acessar rotas publicas, `/login` e `systemSettings/public_config`.
2. **Autenticado corporativo -> Frontend Next.js:** autenticacao Google com dominio `@venetomfo.com.br`.
3. **Frontend autenticado -> API routes:** validadas por `requireCorporateUser` / `requireSuperAdmin` no servidor.
4. **API routes -> Firebase Admin SDK:** chave privada carregada de env.
5. **API routes -> Servicos externos:** `safeFetch` com allowlist (Google Calendar, BrasilAPI, InfoMoney RSS).
6. **Admin -> Firestore:** via regras `firestore.rules`.
7. **CI/CD -> Vercel:** deploy controlado por chave pessoal do CLI.

---

## 3. Atores

| Ator | Capacidades | Risco |
|------|-------------|-------|
| Anonimo externo | Acessar `/login`, rotas publicas | Baixo |
| Usuario corporativo comum | Login Google, ler `systemSettings/config`, ler base de colaboradores | Medio |
| Super admin | Escrever em `systemSettings`, gerenciar colaboradores | Alto (impacto se comprometido) |
| Insider malicioso | Mesmo que super admin se tiver acesso | Alto |
| Atacante com acesso ao `.env` | Usa `FIREBASE_ADMIN_*` para impersonar qualquer usuario | Critico |
| Atacante na rede corporativa | Pode tentar SSRF via rotas que fazem fetch externo | Baixo apos hardening RSS/Calendar |

---

## 4. Top 10 cenarios de abuso plausiveis

### T1 - Enumeration de super admins
- **Hipotese:** usuario corporativo comum le `systemSettings/config.superAdminEmails`.
- **Pre-condicoes:** regra atual permite leitura autenticada.
- **Impacto:** phishing direcionado, pretexting.
- **Evidencia:** `firestore.rules` linha `allow read: if isAuthenticated() && docId in ['config', ...]`.
- **Mitigacao proposta:** mover para `admin_config` restrito a super admin (ver `SYSTEM_SETTINGS_EXPOSURE.md`).

### T2 - Vazamento de service account
- **Hipotese:** arquivo `veneto-connect-firebase-adminsdk-fbsvc-*.json` em `Downloads/` e copiado/compartilhado.
- **Pre-condicoes:** acesso a maquina do dev.
- **Impacto:** Critico; atacante impersona qualquer usuario.
- **Evidencia:** `FIREBASE_LOCAL_AUDIT.md` secao 1.3.
- **Mitigacao:** rotacao de chave, mover para cofre, usar somente Vercel env em producao.

### T3 - SSRF via `/api/rss` (historico)
- **Hipotese:** atacante conseguia passar URL para `parser.parseURL`.
- **Status:** **mitigado** no Bloco 5 (safeFetch + allowlist + limite).
- **Evidencia:** `RSS_SSRF_HARDENING.md`.

### T4 - DoS via XLSX em import de colaboradores
- **Hipotese:** admin sobe planilha malformada que dispara ReDoS / Prototype Pollution.
- **Status:** **mitigado** pelos limites (5 MB, 5k linhas, aba obrigatoria).
- **Evidencia:** `COLLABORATORS_IMPORT_MAX_*` em `ManageCollaborators.tsx`.

### T5 - Manipulacao de `maintenanceMode` por ataque CSRF
- **Hipotese:** super admin logado visita site malicioso que dispara escrita em `systemSettings/public_config`.
- **Pre-condicoes:** SDK Firebase roda no client sem CSRF token; depende de cookie de sessao.
- **Impacto:** colocar plataforma em manutencao.
- **Evidencia:** `firestore.rules` permite escrita se `isSuperAdmin()`.
- **Mitigacao sugerida:** mover writes para endpoint server com double-submit cookie ou SameSite-Lax (ja e default moderno).

### T6 - Enumeracao de colaboradores por autenticado comum
- **Hipotese:** autenticado le toda a colecao `collaborators`.
- **Pre-condicoes:** regra atual `allow read: if isAuthenticated()`.
- **Impacto:** exposicao de PII funcional.
- **Evidencia:** `firestore.rules`.
- **Mitigacao futura:** avaliar necessidade dessa leitura ampla.

### T7 - Bypass de manutencao por timeout no bootstrap
- **Hipotese:** `AuthContext` libera acesso apos `AUTH_LOOKUP_TIMEOUT` mesmo sem colaborador encontrado.
- **Pre-condicoes:** latencia da rede.
- **Impacto:** usuario nao registrado como colaborador poderia, em teoria, acessar temporariamente.
- **Evidencia:** `AuthContext.tsx` flag `collaboratorLookupTimedOut`.
- **Mitigacao:** em caso de timeout, restringir rotas sensiveis no server de qualquer forma.

### T8 - Log leak
- **Hipotese:** log de erro vaza email ou token em ambiente compartilhado.
- **Status:** **mitigado** por `redactForLogs` + `SECURITY_LOG_LEVEL`.
- **Evidencia:** `src/lib/security/logging.ts`.

### T9 - Dependency confusion / supply chain
- **Hipotese:** pacote malicioso publicado com nome parecido (`@genki-ai/...`).
- **Pre-condicoes:** erro de digitacao em `package.json`.
- **Mitigacao:** code review obrigatorio em mudancas de deps + `npm audit` no snapshot.

### T10 - Abuso de `allowedUserIds` durante manutencao
- **Hipotese:** super admin compromissado adiciona seu proprio userId em `allowedUserIds` antes de acionar manutencao, bloqueando todos os outros.
- **Impacto:** negacao de servico interno dirigida.
- **Mitigacao:** auditoria de mudancas em `systemSettings/config` + alerta quando `maintenanceMode=true`.

---

## 5. Superficies expostas

- `/api/billing` (super admin)
- `/api/calendar` (autenticado corporativo)
- `/api/holidays` (autenticado corporativo)
- `/api/rss` (autenticado corporativo)
- Firestore collections abertas para autenticado:
  - `collaborators`, `audit_logs`, `workflows`, `messages`, `polls`, etc. (ver lista MVP em `firestore.rules`)

---

## 6. Controles vigentes

| Controle | Implementacao |
|----------|----------------|
| AuthN server-side | `src/lib/api-auth.ts` |
| AuthZ server-side | `src/lib/security/auth.ts` (`requireSuperAdmin`) |
| Validacao de input | `validateSearchParams` (Zod) |
| IO externo seguro | `safeFetch` + allowlist |
| Logs redigidos | `redactForLogs` |
| Nivel de log | `SECURITY_LOG_LEVEL` |
| Limites de upload | `COLLABORATORS_IMPORT_MAX_*` |
| Middleware de cookie | `middleware.ts` |
| Testes de caso malicioso | `routes.test.ts`, `ManageCollaborators.import.test.ts` |

---

## 7. Risco residual global

- Alto: `superAdminEmails` legivel (Finding 2.1) - ver `SYSTEM_SETTINGS_EXPOSURE.md`.
- Alto: `xlsx` advisories high (aceito formalmente) - ver `XLSX_RISK_REMOVAL_PLAN.md`.
- Medio: colaboradores lidos por qualquer autenticado (T6).
- Baixo: CSRF em writes de super admin (T5).
- Residuais aceitos documentados no proprio diretorio `docs/security/`.
