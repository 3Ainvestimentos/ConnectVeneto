---
name: secure-change-playbook
description: Planeja e executa mudancas no Connect Veneto com hardening obrigatorio, arquitetura minima e validacao por evidencias. Usar quando houver implementacao de feature, refactor, novo endpoint, importacao de arquivo, integracao externa, alteracao em contexto de auth ou qualquer mudanca que toque autenticacao, autorizacao, input externo, systemSettings, firestore.rules ou dependencias.
---

# Secure Change Playbook

Skill obrigatoria para qualquer mudanca funcional neste repositorio.

## Workflow obrigatorio

1. Classificar risco da mudanca: baixo, medio, alto, critico.
2. Identificar superficie de ataque e trust boundaries afetadas.
3. Propor explicitamente:
   - patch minimo (MVP)
   - patch robusto (trade-off)
4. Aplicar hardening padrao:
   - validacao de input com Zod ou equivalente
   - limites de tamanho, formato, quantidade
   - allowlist para chamadas externas
   - timeout em IO
   - autorizacao server-side via `requireCorporateUser` ou `requireSuperAdmin`
5. Logar com `logSecurityEvent` e nunca vazar PII.
6. Testes proporcionais ao risco (caso feliz + caso malicioso).
7. Validar:
   - `npm run lint`
   - `npm run typecheck:gate`
   - `npm run test:ci`
   - `npm run build` (se aplicavel)
   - `npm audit` (se mexer em dependencias)
8. Produzir relatorio com concluido, parcial encontrado, parcial concluido, risco residual.

## Output obrigatorio do agente

Para cada mudanca, responder sempre com:

- (a) Resumo do pedido
- (b) Plano minimo (passos, arquivos afetados, riscos)
- (c) Perguntas objetivas se houver ambiguidade
- (d) Proposta de diff
- (e) Validacao executada
- (f) Pendente de aprovacao antes de executar mudancas destrutivas ou invasivas

## Checklist antes de propor

- [ ] Input externo? Schema e limites definidos.
- [ ] Endpoint? AuthN e AuthZ server-side definidas.
- [ ] IO externo? Allowlist + timeout.
- [ ] Logs? Redacao de sensiveis.
- [ ] Dependencia nova? Versao estavel + `npm audit`.
- [ ] Firestore/systemSettings? Leitura restrita.
- [ ] Teste malicioso minimo adicionado?
- [ ] Risco residual documentado?

## Gatilhos automaticos

Usar esta skill quando a tarefa envolver:

- novas rotas em `src/app/api/**/route.ts`
- upload/parse de arquivos (csv, xlsx)
- mudancas em `AuthContext`, `SystemSettingsContext` ou `middleware.ts`
- alteracao em `firestore.rules`, `.env`, `.env.example`
- adicao/upgrade de dependencias em `package.json`
