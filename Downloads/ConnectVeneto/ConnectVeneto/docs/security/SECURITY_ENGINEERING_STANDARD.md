# Security Engineering Standard — Connect Veneto

Padrao unico de engenharia segura para o projeto. Aplicavel a qualquer mudanca, independente do autor (humano ou agente).

## Principio

Seguranca vem antes de feature. Qualquer mudanca que nao atenda esta baseline deve ser revertida ou bloqueada.

## Obrigatorio em toda mudanca

- Modelagem rapida de ameaca (atacante externo autenticado, usuario comum, admin).
- Validacao de input com Zod ou equivalente.
- Limites explicitos: tamanho de arquivo, numero de linhas, quantidade de URLs, tamanho de string.
- Autorizacao no servidor via `requireCorporateUser` ou `requireSuperAdmin`.
- IO externo exclusivamente via `safeFetch` com allowlist e timeout.
- Logs via `logSecurityEvent` com `redactForLogs`.
- Testes de caso feliz + caso malicioso minimo.
- Evidencia de `lint`, `typecheck:gate`, `test:ci`, `build`.
- Registro de risco residual quando aplicavel.

## Politica de dependencias

- Preferir patch e minor.
- Major apenas em bloco coordenado e aprovado.
- Congelado hoje (nao subir sem aprovacao):
  - `genkit`
  - `genkit-cli`
  - `@genkit-ai/googleai`
  - `@genkit-ai/next`
- `npm audit` obrigatorio apos qualquer upgrade.
- Residuais conhecidos e aceitos devem estar documentados neste diretorio.

### Residuais aceitos

- `xlsx` (SheetJS) - advisories high sem fix upstream. Aceito formalmente.
  Mitigacao ativa via limites em `ManageCollaborators.tsx` (5 MB, 5 000 linhas, aba obrigatoria).
  Plano completo em `XLSX_RISK_REMOVAL_PLAN.md`. Reabrir decisao se surgir advisory critical novo.

## Credenciais

- `.env`, service accounts e tokens fora do repositorio.
- Rotacao imediata se houver exposicao acidental.
- Variaveis de producao exclusivamente via Vercel.
- Nunca imprimir segredo em output do agente.

## systemSettings

- `public_config`: somente `maintenanceMode` e `maintenanceMessage`.
- `config` privado: reduzir campos carregados no client.
- `superAdminEmails` e `collaboratorAdminEmails` devem ser usados preferencialmente no server.

## firestore.rules

- Nao editar automaticamente.
- Entrega e diff textual + plano de aplicacao manual.
- Checklist pos-publicacao obrigatorio.

## Formato de relatorio final

Toda tarefa significativa deve terminar com:

- Concluido
- Parcial encontrado
- Parcial concluido
- Risco residual
- Proximos passos sugeridos

## Referencias internas

- Rules: `.cursor/rules/00-security-hardening-core.mdc`, `01-architecture-solid-review.mdc`, `02-security-review-gate.mdc`, `03-firebase-secrets-guardrails.mdc`
- Skills: `.cursor/skills/secure-change-playbook`, `.cursor/skills/security-review-playbook`
- Camada segura: `src/lib/security/*`
