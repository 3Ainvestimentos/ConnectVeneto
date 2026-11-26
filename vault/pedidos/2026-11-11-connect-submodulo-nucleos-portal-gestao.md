---
tipo: pedido
solicitante: gestao-nucleos
autor: Gustavo Zwetkoff
alvo: connect
data: 2026-11-11
tipo-pedido: modulo-connect
prioridade: normal
status: em-andamento
via: outbox
entregue-em: 2026-11-26
outbox-repo: venetomfo/Gestor_Processos
outbox-arquivo: vault/pedidos/enviados/2026-11-11-connect-submodulo-nucleos-portal-gestao.md
outbox-commit: f75e911
---

> Trazido da outbox do solicitante (`venetomfo/Gestor_Processos`, commit `f75e911`) pelo GitHub API
> em 2026-11-26, a pedido do Victor (mensagem do Gustavo Zwetkoff). Texto abaixo transcrito sem
> alteração até "Resposta do dono".


# Pedido — Permissões do submódulo Núcleos no `portal-gestao` (substitui o pedido de 09/11)

## Contexto

**Este pedido substitui o `2026-11-09-connect-modulo-gestao-nucleos`.** Pode fechar aquele sem
executar.

Por orientação do time de tech (11/11), o acompanhamento dos núcleos da Gestão **não** vira módulo
próprio. Ele entra como **submódulo** do Portal Gestão: repo `venetomfo/modulo-connect-trader-rf`,
`moduleId` `portal-gestao`, no mesmo Web App. No Connect fica **um item só, “Portal Gestão”**, com as
abas Passivos RF e Núcleos lá dentro. O registro está no ADR-0006 do `gestao-nucleos`. O código está
no PR venetomfo/modulo-connect-trader-rf#3, ainda sem merge.

**Passivos RF fica fechado em produção** (decisão do operador, 11/11): ainda não está pronto e
ninguém deve vê-lo no Connect, nem o superadmin. No código, a aba some para todos e toda rota de
Passivos responde 403. Depois do deploy do PR, Passivos some do Connect de propósito.

## O que precisa

### A. Catálogo de permissões do `portal-gestao`

1. **Acrescentar as permissões do submódulo Núcleos:**

| Chave | Rótulo |
|---|---|
| `portal-gestao:nucleos:view` | Núcleos: acessar e ver os núcleos de que participa |
| `portal-gestao:nucleos:all` | Núcleos: ver todos os núcleos (coordenação geral) |
| `portal-gestao:nucleos:edit` | Núcleos: criar e editar projetos, tarefas, marcos e rotinas |
| `portal-gestao:nucleos:plan` | Núcleos: prioridade, cancelamento, sprints |
| `portal-gestao:nucleos:approve` | Núcleos: concluir tarefas e marcos |
| `portal-gestao:nucleos:export` | Núcleos: exportar |
| `portal-gestao:nucleos:admin` | Núcleos: pessoas, participações e importação |

2. **Criar `portal-gestao:passivos:view`, sem conceder a ninguém por enquanto.** No PR, Passivos
   passa a exigir essa chave, e `portal-gestao:view` só deixa entrar no portal. Como Passivos está
   fechado em produção, conceder agora não muda nada. Quando ele for liberado, a ordem é:
   1. conceder a chave aos officers, à gestão e ao compliance;
   2. trocar `liberado: false` para `true` em `src/plataforma/submodulos.ts`, no repo do portal.

   Precisa do OK de vocês, porque mexe no código de Passivos.

### B. Quem concede as permissões de Núcleos

No hub, a gestão de acessos é por módulo (`portal-gestao:manage`). Quem tem essa permissão
concede também as de Passivos, e não queremos isso. São duas saídas:

1. o hub permite gestão por prefixo (`portal-gestao:nucleos:*` para `gustavo.z@venetomfo.com.br`);
2. a plataforma concede, e nós mandamos a lista.

Qual vocês preferem?

### C. Quem recebe o quê

Matriz aprovada (TEC06, opção B). Todos os liberados também recebem `portal-gestao:view`:
- **membros com núcleo:** `view`, `edit`, `plan`, `approve` e `export`;
- **Rodrigo:** tudo, menos `manage`;
- **Gustavo:** tudo;
- **Keven e Lucas C.:** sem acesso por enquanto.

O acesso de Raphael, Luis, Felipe e Pedro depende da composição de EQ e ALT, ainda “a confirmar”.
Ninguém de Núcleos recebe permissão de Passivos, e nenhum officer recebe `portal-gestao:nucleos:*`.

### D. Deploy do PR

- O build precisa rodar `npm ci` com os scripts habilitados: o `postinstall` gera o client Prisma
  de Núcleos.
- A pasta gerada `src/modulos/nucleos/prisma/gerado/` precisa estar no servidor quando o app rodar
  (`next start` a partir da raiz).
- **Nenhuma variável de ambiente nova.** Núcleos usa as `MSSQL_*` que já existem, com o mesmo login.
  Não configurem `DATABASE_URL`.
- Núcleos só funciona em produção depois do pedido ao db-guardian
  (`2026-11-11-db-guardian-acesso-portal-gestao`); sem ele, as rotas de Núcleos dão 500.

## Critérios de aceite

- Catálogo do `portal-gestao` com as chaves de A1 e a de A2 (esta sem concessões).
- Permissões de Núcleos concedidas conforme C.
- Resposta sobre B.
- Pedido de 09/11 encerrado como substituído.

## Resposta do dono

**2026-11-26 — Em andamento: plano pronto, sem nada gravado no Firestore.** Processado pelo connect (subagente, a
pedido do Victor Santos). Toda escrita abaixo é produção e espera a aprovação do Victor.

Chegou: trouxemos o pedido da sua outbox (`f75e911`) pelo GitHub API. O pedido de 09/11 foi encerrado como
`substituido` ([[2026-11-09-connect-modulo-gestao-nucleos]]).

### O que conferimos no código do Connect (`origin/main` `4193b74`)

- **Catálogo.** Mora no campo `permissionCatalog` (`[{ key, label }]`) do doc `hubModules/portal-gestao` do
  Firestore. O `portal-gestao` **não** está no `src/config/hub-modules.seed.json`: só existe no Firestore (está na
  ordem do menu desde 26/10). A API `/api/admin/modules` (só super admin) exige que a chave comece com
  `portal-gestao:` e que o rótulo tenha até 60 caracteres. O rótulo mais longo de A1 tem 59.
- **Token.** O módulo recebe `modulePermissions['portal-gestao']` da pessoa exatamente como está gravado (com
  `accessMode: explicit`, só quem tem `portal-gestao:view`). O super admin recebe `adminPermissions` e
  `role: superadmin`. O portal trata `superadmin` como todas as permissões; Passivos continua fechado para ele pelo
  `liberado: false`.
- **Quem concede.** Desde o PR #60 (ADR 0005 do Connect, 22/10), `/{slug}/admin` não grava mais nada e só manda
  para Administração › Acessos. A tela chama `PATCH /api/admin/access/people`, que aceita só super admin
  (`systemSettings/config.superAdminEmails`) ou admin do cadastro, o RH (`collaboratorAdminEmails`).
  **`portal-gestao:manage` hoje não dá a ninguém o poder de conceder nada no Connect.** É só uma chave que chega
  no token. No portal, ela administra officers e delegações de Passivos.

### B. Resposta: opção 2, a plataforma concede pela lista

- **A opção 1 não existe.** O hub não delega a gestão de acessos, nem por módulo nem por prefixo. Para construir,
  seria preciso criar uma feature: papel de gestor por prefixo, checagem na API e tela. Isso também desfaz a
  centralização decidida no ADR 0005. Não compensa para cerca de 10 pessoas.
- **Fica com vocês, sem depender da plataforma:** quem participa de qual núcleo. Isso é feito dentro do portal, com
  `portal-gestao:nucleos:admin` (Gustavo e Rodrigo). O hub só liga as chaves gerais.
- **Mudanças depois:** um pedido `acesso-connect` ao connect, com o e-mail da pessoa e as chaves. O Victor (ou o RH)
  aplica em Administração › Acessos.

### Plano (tudo aguarda o Victor)

1. **Pré-checagem (só leitura do Firestore).** Rodar o script do passo 2 em dry-run. Ele lista o
   `hubModules/portal-gestao` (`enabled`, `url`, `accessMode`, `permissionCatalog`, `adminPermissions`) e o
   `modulePermissions['portal-gestao']` atual de cada pessoa da matriz. Esse estado vira a base do rollback.
2. **Script novo** `Downloads/ConnectVeneto/ConnectVeneto/scripts/portal-gestao-nucleos.mjs`, no molde do
   `add-legal-advisory-module.mjs`. Ele roda em dry-run por padrão, é idempotente e só acrescenta:
   - `--apply`: acrescenta ao `permissionCatalog` as 8 entradas da tabela abaixo, sem tirar nenhuma, e atualiza
     `updatedAt` e `updatedBy`;
   - `--apply --acessos`: junta as chaves da lista ao `modulePermissions['portal-gestao']` de cada pessoa, grava
     `collaborator_logs` (`source: pedido-portal-gestao-nucleos`) e incrementa
     `systemSettings/config.collaboratorTableVersion`, como o `PATCH /api/admin/access/people` faz;
   - **sem script:** catálogo pela tela Admin › Módulos (uma linha `chave | Rótulo` por entrada) e concessões pela
     tela Acessos.
3. **Catálogo (A1 + A2).** Rótulos como no pedido:

   | Chave | Rótulo |
   |---|---|
   | `portal-gestao:nucleos:view` | Núcleos: acessar e ver os núcleos de que participa |
   | `portal-gestao:nucleos:all` | Núcleos: ver todos os núcleos (coordenação geral) |
   | `portal-gestao:nucleos:edit` | Núcleos: criar e editar projetos, tarefas, marcos e rotinas |
   | `portal-gestao:nucleos:plan` | Núcleos: prioridade, cancelamento, sprints |
   | `portal-gestao:nucleos:approve` | Núcleos: concluir tarefas e marcos |
   | `portal-gestao:nucleos:export` | Núcleos: exportar |
   | `portal-gestao:nucleos:admin` | Núcleos: pessoas, participações e importação |
   | `portal-gestao:passivos:view` | Acessar Passivos RF (officer), **sem concessão** |

   `adminPermissions` não muda, porque o super admin já vale como todas as permissões no portal.
4. **Concessões (C), pela opção B da `MATRIZ_PERMISSOES.md`:**

   | Pessoa | Chaves (`portal-gestao:` +) | Quando |
   |---|---|---|
   | Gustavo (`gustavo.z@venetomfo.com.br`) | `view`, `nucleos:{view,all,edit,plan,approve,export,admin}` | agora. O que ele já tem fica como está (inclusive `manage` e Passivos, que está registrado desde 22/10 como "Portal de Gestão completo") |
   | Rodrigo | `view`, `nucleos:{view,all,edit,plan,approve,export,admin}` | agora |
   | Lucas P., Túlio | `view`, `nucleos:{view,edit,plan,approve,export}` | agora |
   | Pedro, Felipe, Raphael, Luis | iguais aos de Lucas P. | **só depois** que vocês confirmarem a composição de EQ e ALT |
   | Keven, Lucas C. | nenhuma | — |

   **Falta:** a matriz não traz os e-mails. O dry-run procura cada nome em `collaborators`, o Victor confere, e nome
   ambíguo fica de fora. Se puderem, mandem os e-mails numa resposta ou num pedido `acesso-connect`.
5. **A2 (OK do connect):** do lado do hub, nada contra criar `passivos:view` sem conceder a ninguém, nem contra a
   ordem de liberação proposta (primeiro conceder, depois `liberado: true`). O OK de produto sobre Passivos é do
   operador.
6. **D (deploy do PR #3) não é do connect.** O código e o pipeline são do `venetomfo/modulo-connect-trader-rf`, e o
   App Service `vnt-trader-rf` é do `seguranca`. No hub nada muda: mesma URL, mesmo `moduleId`, mesma CSP. O
   pré-requisito de banco (`2026-11-11-db-guardian-acesso-portal-gestao`) foi **concluído pelo db-guardian em
   26/11**. Conceder as chaves antes do deploy não quebra nada, porque o portal atual ignora as chaves novas.
7. **Teste:** o Victor simula (`simulateAs` de super admin) o Rodrigo e um membro. O membro deve ver só os núcleos
   dele e não ver a aba Passivos. O Rodrigo deve ver todos os núcleos e a Administração.

**Dependência paralela (não decidida aqui):** está em aberto se o Trader RF entra como seção do módulo `gestao`
(fundos-asset) ou fica módulo separado (pedido `2026-11-26-fundos-asset-secoes-gestao-de-investimentos`, do
ia-gestor). Ela não bloqueia este pedido. Se a decisão for "seção do `gestao`", as chaves trocam de prefixo e as
concessões são refeitas. Para cerca de 10 pessoas, o custo é baixo.

**Rollback:** tirar as 8 entradas do `permissionCatalog` e, de cada pessoa, as chaves `portal-gestao:nucleos:*`
(mais `portal-gestao:view` de quem não tinha antes), voltando ao estado do dry-run. Os logs ficam em
`collaborator_logs` com `source: pedido-portal-gestao-nucleos`. A entrada no changelog do connect é feita quando
aplicar.
