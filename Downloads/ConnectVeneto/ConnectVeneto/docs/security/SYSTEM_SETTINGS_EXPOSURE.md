# Analise de exposicao de `systemSettings`

Analise detalhada do que qualquer usuario autenticado consegue ler em
`systemSettings/*`, avaliando o risco real e propondo endurecimento
com impacto de UX explicitado antes de qualquer mudanca.

---

## 1. Estado atual

### 1.1. Regras do Firestore

`firestore.rules` concede:

```
match /systemSettings/{docId} {
  allow read: if docId == 'public_config';
  allow read: if isAuthenticated() && docId in ['config', 'admin_config', 'keys'];
  allow write: if isSuperAdmin() && docId in ['public_config', 'config', 'admin_config', 'keys'];
}
```

Implicacoes:
- Qualquer usuario autenticado com email corporativo le:
  - `systemSettings/config`
  - `systemSettings/admin_config`
  - `systemSettings/keys`
- Nao autenticados leem apenas `systemSettings/public_config`.

### 1.2. Conteudo do `systemSettings/config` (modelo)

Definido em `src/contexts/SystemSettingsContext.tsx` (interface `SystemSettings`):

- `maintenanceMode`, `maintenanceMessage`
- `allowedUserIds[]`
- `termsUrl`, `termsVersion`, `privacyPolicyUrl`, `privacyPolicyVersion`
- `superAdminEmails[]`
- `collaboratorAdminEmails[]`
- `collaboratorTableVersion`
- `isRssNewsletterActive`, `rssNewsletterUrl`
- `loginFrequencyGoal`

### 1.3. Consumidores no client

Arquivos que leem `systemSettings` no frontend:

- `src/contexts/SystemSettingsContext.tsx`
- `src/contexts/AuthContext.tsx` (via `fetchPrivateSystemSettings`)
- `src/components/layout/AppLayout.tsx`
- `src/shared/components/layout/AppLayout.tsx`
- `src/components/guides/FAQModal.tsx`
- `src/components/applications/ProfileModal.tsx`
- `src/components/admin/MaintenanceMode.tsx`
- `src/components/admin/ManageNewsletter.tsx`
- `src/components/rss/DailyRssModal.tsx`
- `src/components/providers/AppProviders.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(app)/audit/page.tsx`
- `src/app/(app)/admin/content/page.tsx`

---

## 2. Findings

### Finding 2.1 - `superAdminEmails` legivel por qualquer autenticado
- **Severidade:** Alto
- **Hipotese de exploracao:** usuario autenticado corporativo le a lista de super admins
  e usa para engenharia social direcionada (phishing, pretexting).
- **Pre-condicoes:** apenas autenticacao com email `@venetomfo.com.br`.
- **Impacto real:** exposicao de PII funcional e mapa de privilegios.
- **Evidencia:** `firestore.rules` linha `allow read: if isAuthenticated() && docId in ['config', ...]`
  e `SystemSettingsContext.tsx` linha `fetchPrivateSystemSettings`.
- **Nao e falso positivo:** qualquer colaborador pode abrir DevTools -> Network -> buscar
  pelo payload de `systemSettings/config` e extrair a lista.

### Finding 2.2 - `collaboratorAdminEmails` com mesma exposicao
- **Severidade:** Medio
- **Hipotese:** mesma de 2.1, focada em papel de importador de colaboradores.
- **Impacto:** menor que 2.1, mas revela papel operacional.

### Finding 2.3 - `allowedUserIds` visivel durante manutencao
- **Severidade:** Baixo
- **Hipotese:** lista de userIds autorizados durante manutencao pode ser usada para inferir
  quais contas sao "vip" no sistema.
- **Impacto:** baixo; apenas ids, nao emails diretos.

### Finding 2.4 - `admin_config` e `keys` liberados mas conteudo desconhecido
- **Severidade:** Indefinido ate inspecao manual.
- **Hipotese:** se esses docs tiverem chaves de API, webhooks, ou endpoints
  privados, qualquer autenticado acessa.
- **Pre-condicoes:** existir conteudo nessas docs.
- **Acao recomendada:** validar manualmente o conteudo dos documentos no Firestore
  antes de decidir pelo endurecimento.

### Finding 2.5 - `AuthContext` e `SystemSettingsContext` carregam config privada automaticamente
- **Severidade:** Baixo tecnico, Medio pelo padrao arquitetural.
- **Evidencia:** `SystemSettingsContext` faz `fetchPrivateSystemSettings()` assim que
  `authUid` esta disponivel.
- **Impacto:** cada sessao loga a lista completa, inclusive para contas com permissoes
  minimas. Consumo desnecessario de banda e exposicao redundante.

---

## 3. Proposta de endurecimento

### Patch minimo (sem mudanca de UX)

1. Mover campos sensiveis de `systemSettings/config` para `systemSettings/admin_config`.
   - `superAdminEmails` -> `admin_config.superAdminEmails`
   - `collaboratorAdminEmails` -> `admin_config.collaboratorAdminEmails`
   - `allowedUserIds` -> `admin_config.allowedUserIds`
2. Reescrever leitura em `SystemSettingsContext`/`AuthContext` para **nao** buscar
   `admin_config` no client comum.
3. Manter no `config` apenas dados necessarios no frontend:
   - `maintenanceMode`, `maintenanceMessage`
   - `termsUrl`, `termsVersion`, `privacyPolicyUrl`, `privacyPolicyVersion`
   - `collaboratorTableVersion`
   - `isRssNewsletterActive`, `rssNewsletterUrl`
   - `loginFrequencyGoal`
4. Deixar `admin_config` acessivel via rota `/api/admin/settings` server-side com
   `requireSuperAdmin`. Componentes admin (`MaintenanceMode`, `ManageNewsletter`)
   consomem via API.
5. Em `firestore.rules`, restringir:
   - `admin_config`: read apenas `isSuperAdmin()`.
   - `keys`: read apenas `isSuperAdmin()`.

### Patch robusto (com revisao de UX)

- Alem do patch minimo, adicionar endpoint `/api/admin/maintenance` que
  toggle de manutencao passe pelo server com log de auditoria.
- Substituir leituras diretas do Firestore em componentes admin por hooks que
  batem no server (padrao "BFF leve").
- Introduzir cache server-side com TTL curto para reduzir custos.

### Impacto de UX

| Fluxo | Impacto |
|-------|---------|
| Login comum | Nenhum. Dados lidos pelo client ficam iguais. |
| Dashboard, widgets, modais | Nenhum. |
| Painel admin de manutencao | Pequeno: passa a depender de rota autenticada; admin precisa ter token valido. |
| Painel admin de newsletter | Pequeno: idem. |
| `AuthContext` checando super admin | Mantido via `requireSuperAdmin` server-side em rotas sensiveis. Decisao de UI (mostrar botoes) passa a depender de claim/Firebase custom claim ou de endpoint `/api/me`. |

### Pre-requisito para executar

- Inspecao manual do conteudo atual de `systemSettings/admin_config` e `keys`.
- Plano de migracao em 2 passos:
  1. Criar `admin_config` com copia dos campos sensiveis mas manter `config` intacto.
  2. Remover campos de `config` em deploy separado apos confirmar que nenhum componente ainda le.

---

## 4. Risco residual apos patch minimo

- Usuario autenticado ainda vai ver `config` publico-interno. Nao contem PII funcional critica.
- Campos sensiveis passam a depender de `isSuperAdmin()`.
- Restaria apenas revisar `isCollaboratorImporter` para mover tambem, em bloco futuro.

---

## 5. Recomendacao final

Executar **patch minimo** em bloco dedicado. Nao mesclar com Parcial 9 (firestore.rules)
porque a mudanca de rules depende da migracao de dados ja estar feita e validada.

Sequencia segura:

1. Copiar campos sensiveis para `admin_config` (via console Firestore ou script server-side).
2. Adaptar leitura do client para nao mais depender desses campos.
3. Publicar novas `firestore.rules` restringindo `admin_config`/`keys` a super admin.
4. Remover campos antigos de `config` em deploy final.

---

## 6. Execucao (Phase A concluida)

**Executado em codigo:**

- `src/app/api/me/session/route.ts` - GET protegido por `requireCorporateUser`. Le `admin_config` primeiro e, em fallback, `config`. Retorna apenas decisao de `isSuperAdmin`, `maintenanceMode`, `maintenanceMessage` e `allowedUserIds`. **Nunca expoe `superAdminEmails`**.
- `src/app/api/admin/settings/route.ts` - GET protegido por `requireSuperAdmin`. Retorna campos administrativos para UI de super admin. Consumidor futuro: `MaintenanceMode` e similares.
- `src/lib/session-client.ts` - helper `fetchClientSessionInfo(user)` para o client obter o decisao do server com fallback silencioso.
- `src/contexts/AuthContext.tsx` - em `onAuthStateChanged` e `signInWithGoogle`, a decisao de `isSuperAdmin` agora **prefere a resposta do server**. Fallback para o comportamento historico preservado.

**Validacoes:**

- Typecheck: passou.
- 116 testes unit/integration: passam.
- Dev server compilou `/api/me/session` e respondeu 200 em chamada real.

**Phase B concluida em codigo:**

1. `src/app/api/me/session/route.ts` estendido: retorna todos os campos seguros de `SystemSettings` para UI comum (maintenance, terms, privacy, rssNewsletter, etc). **Nunca** retorna `superAdminEmails` ou `collaboratorAdminEmails`.
2. `src/app/api/admin/settings/route.ts`: continua sendo a unica fonte dos campos sensiveis (restrito a super admin).
3. `src/contexts/SystemSettingsContext.tsx` reescrito:
   - `fetchPrivateSystemSettings` nao le mais `config` via SDK.
   - Em vez disso chama `/api/me/session`. Se `isSuperAdmin`, tambem chama `/api/admin/settings` e merge.
   - Se nenhum dos endpoints responde, retorna `defaultSettings` (sem vazar nada).
4. `MaintenanceMode.tsx` continua funcionando sem mudanca: para super admin, `settings.superAdminEmails` e `settings.collaboratorAdminEmails` seguem populados via merge do endpoint `/api/admin/settings`.

**Efeito pratico:**

- Browser de usuario comum nao recebe mais `superAdminEmails` nem `collaboratorAdminEmails`.
- `F-01` (super admin emails leak) pode ser fechado apos aplicar `firestore.rules.proposed`.

**Validacoes:**

- Typecheck: passou.
- 116 testes: todos passando.
- Dev server real: `/api/me/session 200`, `/api/admin/settings 200`, `/api/calendar 200`, `/api/rss 200`, dashboard carregando sem erro.

**Proximo passo:**

- Aplicar `firestore.rules.proposed` (restringe leitura de `config` a super admin). Nao requer migracao de dados.
- Seguir checklist em `FIRESTORE_RULES_DIFF.md`.
