---
tipo: pedido
solicitante: projeto-trader-rf
autor: gustavo.zwetkoff
alvo: connect
data: 2026-10-15
tipo-pedido: modulo-connect
prioridade: normal
status: em-andamento
encaminhado-por: db-guardian (itens A e B, 2026-10-15)
alvo-original: db-guardian
depende-de: "resposta à pergunta 1 de ia-gestor → fundos-asset 2026-11-26-fundos-asset-secoes-gestao-de-investimentos (Trader RF como seção do gestao ou módulo separado)"
via: outbox
entregue-em: 2026-11-26
outbox-repo: venetomfo/Projeto_Trader_RF
outbox-arquivo: vault/pedidos/enviados/2026-10-15-modulo-connect-passivos-dependencias-plataforma.md
outbox-commit: 37354d5
---

> Trazido da outbox do solicitante (`venetomfo/Projeto_Trader_RF`, commit `37354d5`) pelo GitHub API
> em 2026-11-26, a pedido do Victor (mensagem do Gustavo Zwetkoff). Texto abaixo transcrito sem
> alteração até "Resposta do dono".
> No original, `alvo: db-guardian` e `tipo-pedido: outro`. O db-guardian respondeu a seção C e
> encaminhou os itens A e B ao dono do ConnectVeneto (15/10). Por isso o pedido entra nesta inbox
> com `alvo: connect`, e só A e B são tratados aqui.


# Pedido — Itens de plataforma para o módulo de passivos e exceções de RF no Connect

## Contexto

O Trader RF (domínio `projeto-trader-rf`, repo `venetomfo/Projeto_Trader_RF`) vai ter um
**módulo no ConnectVeneto** para os officers verem os passivos de RF dos clientes, darem
ciência e pedirem exceção. A gestão aprova as exceções e o compliance consulta as
evidências. Não é produto para clientes.

Lemos o `CONNECTVENETO_MODULE_PROTOCOL.md` (v1.5). Ele responde o caminho de integração e a
parte de identidade e notificações. Sobram alguns itens que só a plataforma pode fazer, e
outros que o protocolo não cobre. Juntamos tudo num pedido único **para você verificar e
encaminhar o que for de outro domínio seu** (sabemos que web app e storage são do
`seguranca` pelo registro; mandamos aqui para não abrir quatro pedidos sem saber a divisão).

Este pedido **substitui na prática** o pedido de 2026-10-09 ao `integracoes`
(`2026-10-09-integracao-connect-modulo-passivos-excecoes.md`): o protocolo já respondeu a
maior parte dele. Especificação de negócio: `docs/Spec_Connect_Passivos_Excecoes.md` (v0.3).

## O que precisa

### A. Cadastro do módulo no Connect (Admin → Módulos)

1. **Criar o `moduleId`.** Sugestão: `trader-rf` (aceitamos outro).
2. **Cadastrar o módulo desativado**, para teste. Os dados que nos cabem (nome, ícone,
   endereço, rota `/embed`, catálogo de permissões, `accessMode: explicit`, layout) mandamos
   assim que o servidor existir (item C1). Catálogo previsto:
   - `trader-rf:view` — acessar o módulo (officer vê só os clientes dele);
   - `trader-rf:excecao:approve` — aprovar ou rejeitar exceções (gestão);
   - `trader-rf:evidencia:view` — ver as evidências de todos (gestão e compliance);
   - `trader-rf:report` — visão da base inteira (gestão);
   - `trader-rf:manage` — gerenciar acessos do módulo.
3. **Dar `trader-rf:manage` para `gustavo.z@venetomfo.com.br`**, para liberarmos officers,
   gestão e compliance sem depender da plataforma a cada mudança.

### B. Segredo e ambiente de teste

1. **`HUB_JWT_SECRET`**, entregue por canal seguro (Bitwarden ou equivalente, nunca por
   e-mail/chat).
2. **Pacote do ConnectVeneto Sandbox**, para testar o handshake localmente.
3. **Um teste conjunto da Central de Notificações** (`/api/hub/notifications` com
   `readPolicy: on_resolve`), que o Sandbox não cobre.

### C. Itens fora do protocolo — confirmar quem faz e como

1. **Servidor do módulo:** Azure Web App em `*.azurewebsites.net` (ou `*.venetomfo.com.br`).
   Entendemos que é `recurso-azure` do `seguranca` — confirmar e encaminhar.
2. **Armazenamento das evidências:** o officer anexa o e-mail com o consentimento do
   cliente. Precisamos de um storage com acesso do officer (só os dele), da gestão e do
   compliance. Há padrão na casa?
3. **Banco:** schema próprio no `veneto-banco-desenvolvimento` (como o `real_estate` do
   real-estate-report) e **2 usuários de menor privilégio**:
   - **pipeline** (desktop do operador): escreve as tabelas de passivos e política, lê as de
     ciência, pedidos e decisões;
   - **módulo** (web app): o inverso.
   O rascunho das tabelas está na seção 6 da spec. Mandamos a DDL proposta num pedido `ddl`
   separado depois da sua orientação de convenção.
4. **Acesso do pipeline ao banco a partir do desktop:** a rotina agendada de 12/10 rodou sem
   banco por bloqueio de firewall do IP. Qual o caminho recomendado para um pipeline em
   desktop gravar nesse schema de forma estável (IP fixo no firewall, VPN, outro)?
5. **Algum domínio ou passo faltando** nesta lista?

## Critérios de aceite

- `moduleId` criado e módulo cadastrado desativado; `trader-rf:manage` concedido.
- `HUB_JWT_SECRET` e Sandbox entregues por canal seguro.
- Resposta (ou encaminhamento) para cada item da seção C, com quem é o dono de cada um.

## Resposta do dono

> **Resposta do db-guardian (15/10), resumida.** A seção C foi respondida e encaminhada pelo db-guardian: Web App e
> storage ao `seguranca`, schema e logins ao db-guardian. Os itens **A e B** foram encaminhados ao "dono do
> ConnectVeneto" por canal humano, porque o connect ainda não tinha inbox. A resposta completa está no arquivo
> original da outbox e em `db-gaurdian/vault/pedidos/2026-10-15-modulo-connect-passivos-dependencias-plataforma.md`.
> Daqui para baixo, só os itens A e B, que são do connect.

**2026-11-26 — Em andamento: situação real levantada; o resto depende de uma decisão tomada em paralelo.**
Processado pelo connect (subagente, a pedido do Victor Santos). Nada foi gravado.

### O que já aconteceu fora do framework (vault do connect, do seguranca e repo do módulo)

- **A1. O `moduleId` não é `trader-rf`. É `portal-gestao`.** O módulo foi construído no repo
  `venetomfo/modulo-connect-trader-rf` (`NEXT_PUBLIC_MODULE_ID="portal-gestao"`, PR #2 de 21/10). O doc
  `hubModules/portal-gestao` existe no Firestore: está na ordem do menu do changelog do connect de 26/10. Ele não está
  no `hub-modules.seed.json`.
- **A3.** O Gustavo aparece com "Portal de Gestão completo" na migração de acessos de 22/10 (ADR 0005 do Connect).
- **C1/C2.** O `vnt-trader-rf` e o `sttraderrf` foram criados pelo `seguranca` em 21/10. O pedido de lá segue
  `em-andamento` até o teste ponta a ponta no Connect.
- **Catálogo atual do portal** (código `main`): `portal-gestao:view`, `passivos:all`, `excecao:approve`,
  `evidencia:view` e `manage`. O PR #3 acrescenta `passivos:view` e `nucleos:*`, que estão no pedido
  [[2026-11-11-connect-submodulo-nucleos-portal-gestao]].
- **Ainda não confirmado** (o dry-run do passo 1 resolve):
  - se o `hubModules/portal-gestao` está `enabled` e com `url` `https://vnt-trader-rf.azurewebsites.net` e
    `embedPath` `/embed`;
  - se o `HUB_JWT_SECRET` já está na App Setting do `vnt-trader-rf`. Não há registro disso no vault do connect nem
    no do `seguranca`.
  - O pedido do ia-gestor de 26/11 diz que o Trader RF está "aguardando cadastro", o que diverge do registro acima.

### Dependência (não decidida aqui)

Pergunta 1 do pedido `2026-11-26-fundos-asset-secoes-gestao-de-investimentos` (do ia-gestor para o fundos-asset,
commit `69cf364` do `venetomfo/IA_Gestor_Veneto`): **o Trader RF entra como seção do módulo `gestao`
(fundos-asset) ou fica módulo separado sob o mesmo menu "Gestão de Investimentos"?** Outro agente está tratando
dessa pergunta em paralelo. Este pedido segue `em-andamento` até ela ser respondida.

### Plano por desfecho (tudo aguarda o Victor)

1. **Antes de tudo, só leitura:** rodar em dry-run o script do pedido de 11/11, que também lista o
   `hubModules/portal-gestao` e o menu atual.
2. **Desfecho (a): módulo separado, mantendo o `portal-gestao`.**
   - Conferir o `hubModules/portal-gestao` e ajustar se precisar: `url` `https://vnt-trader-rf.azurewebsites.net`,
     `embedPath` `/embed`, `accessMode: explicit`, `enabled: true`, catálogo igual ao do pedido de 11/11.
   - **"Mesmo menu" hoje significa itens vizinhos.** O menu do hub é uma lista plana ordenada por `order`.
     `hubModules` não tem grupo nem submenu. Sem código, o que dá para fazer é deixar o `portal-gestao` com `order`
     logo abaixo do `gestao` e com rótulos coerentes (ex.: "Gestão de Investimentos" e "Portal Gestão"). Um grupo
     de verdade exige um PR no Connect: campo `group` no `embeddedModuleSchema` (`src/config/modules.ts`), render
     agrupado no menu e o campo na tela Admin › Módulos. O código é livre; o merge e o deploy, não.
   - A concessão de Passivos (officers, gestão, compliance) fica para quando o Passivos for liberado
     (`liberado: true`), pela ordem combinada no pedido de 11/11.
3. **Desfecho (b): seção do `gestao`.**
   - As telas de Passivos passam para o repo `fundos-asset` (decisão e trabalho do fundos-asset).
   - No hub, o catálogo do `gestao` ganha as chaves de Passivos (ex.: `gestao:passivos:view`,
     `gestao:passivos:all`, `gestao:excecao:approve`, `gestao:evidencia:view`). As concessões migram de
     `portal-gestao:*` para `gestao:*`, e o `hubModules/portal-gestao` vai para `enabled: false` depois da migração.
   - **Impacto grande:** Núcleos acabou de virar submódulo do `portal-gestao` (ADR-0006 do `gestao-nucleos`, pedido
     de 11/11) e teria que ir junto ou ficar sozinho no portal.
   - O banco também muda: o login de leitura do `gestao` precisaria de acesso ao schema `trader_rf`, por pedido do
     dono ao db-guardian.
4. **B1. `HUB_JWT_SECRET`.** É **um segredo só do hub para todos os módulos**: não se gera um segredo novo. O
   caminho usado no `legal-advisory` foi o `seguranca` copiar a App Setting `HUB_JWT_SECRET` de outro app (ex.:
   `vnt-debriefing-reunioes`) para o `vnt-trader-rf`, sem passar por chat, arquivo ou vault. A Vêneto não usa
   Bitwarden. Só vale no desfecho (a), e só se a pré-checagem mostrar que falta. Aí sai um `/pedir seguranca` (App
   Setting do `vnt-trader-rf`). No desfecho (b) não se aplica, porque o `gestao` já tem o segredo.
5. **B2. Sandbox.** O pacote é a pasta local `intranet-veneto/connectveneto-sandbox` (não é repo git), entregue sem
   `node_modules`, `.next` e `.env.local`. O `.env.sandbox` traz o segredo de sandbox, que é público e só serve para
   dev (protocolo §15). O PR #3 já foi testado com o login simulado do próprio módulo, então o Sandbox é opcional
   agora. Se o Gustavo ainda quiser, o Victor envia por fora do git.
6. **B3. Teste conjunto de notificações** (`on_resolve`): adiado até o Passivos ser liberado. Hoje está fechado e o
   módulo roda com `HUB_NOTIFICACOES="0"`.

**Rollback:** nada foi aplicado. Cada passo acima, quando aprovado, gera uma entrada no changelog do connect com o
rollback dele.
