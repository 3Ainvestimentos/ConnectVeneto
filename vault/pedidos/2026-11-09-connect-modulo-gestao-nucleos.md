---
tipo: pedido
solicitante: gestao-nucleos
autor: Gustavo Zwetkoff
alvo: connect
data: 2026-11-09
tipo-pedido: modulo-connect
prioridade: normal
status: substituido
substituido-por: 2026-11-11-connect-submodulo-nucleos-portal-gestao.md
via: outbox
entregue-em: 2026-11-26
outbox-repo: venetomfo/Gestor_Processos
outbox-arquivo: vault/pedidos/enviados/2026-11-09-connect-modulo-gestao-nucleos.md
outbox-commit: 3f8fc2d
---

> Trazido da outbox do solicitante (`venetomfo/Gestor_Processos`, commit `3f8fc2d`) pelo GitHub API
> em 2026-11-26, a pedido do Victor (mensagem do Gustavo Zwetkoff). Texto abaixo transcrito sem
> alteração até "Resposta do dono".


# Pedido — Cadastro do módulo `gestao-nucleos` (acompanhamento dos núcleos da Gestão), segredo e Sandbox

## Contexto

O domínio `gestao-nucleos` (repo `venetomfo/Gestor_Processos`, pasta `sistema/`) acompanha os oito
núcleos da Gestão: projetos, marcos, tarefas, rotinas, sprints e reuniões. O público é o time
da Gestão, cerca de 10 pessoas. Hoje roda só na máquina do operador, sem login. Para abrir ao
time, decidimos que ele será **módulo próprio** no ConnectVeneto (mesmo caminho do Trader RF).

O protocolo v1.5 **já está implementado** no sistema:

- `lib/hub-auth.ts` canônico;
- rota `/embed` com `?next=` validado e `/api/hub-verify`;
- sessão padrão A (Bearer em memória) e `CV_MODULE_READY`;
- `frame-ancestors` com o hub, sem `X-Frame-Options`;
- permissão verificada no servidor em toda rota.

Os pedidos de banco (`db-guardian`) e de Web App (`seguranca`) saem junto com este.

## O que precisa

### A. Cadastro no hub (Admin → Módulos)

1. **`moduleId`: `gestao-nucleos`** (já é o padrão do código; se preferir outro, trocamos por
   variável de ambiente).
2. **Cadastrar desativado**, para teste, com `accessMode: explicit`. O endereço do Web App vai
   assim que o `seguranca` criar o recurso; a rota é `/embed`.
3. **Catálogo de permissões** (o que o sistema já verifica):
   - `gestao-nucleos:view`: acessar o módulo e ver **os núcleos de que a pessoa participa**
     (o vínculo pessoa ↔ núcleo é cadastrado no próprio módulo, pelo e-mail do token);
   - `gestao-nucleos:all`: ver todos os núcleos (coordenação geral e operador do módulo; nós concedemos
     pelo `manage` do item 4);
   - `gestao-nucleos:edit`: criar e editar projetos, marcos, tarefas e rotinas;
   - `gestao-nucleos:plan`: planejar sprints, prioridades, capacidade e cancelamentos;
   - `gestao-nucleos:approve`: aceitar a conclusão de tarefas e marcos;
   - `gestao-nucleos:export`: exportar dados;
   - `gestao-nucleos:admin`: configurações internas (pessoas e importação);
   - `gestao-nucleos:manage`: reservada do hub, para a gestão de acessos.
4. **Dar `gestao-nucleos:manage` para `gustavo.z@venetomfo.com.br`**, para liberarmos o time sem
   depender da plataforma a cada mudança.
5. **Menu:** item próximo de "Gestão", se possível, para a área ficar junta.

### B. Segredo e ambiente de teste

1. **`HUB_JWT_SECRET`** por Bitwarden (nunca por e-mail ou chat).
2. **Pacote do ConnectVeneto Sandbox**, para testar o handshake antes do cadastro real.

### C. Uma dúvida de padrão visual

O módulo hoje usa a identidade do Trader RF (navy `#1A2744` e dourado `#B89A4E`). Dentro do iframe,
o cabeçalho próprio fica escondido. Esse padrão vale para os módulos, ou devemos seguir o §14 do
protocolo (dourado `#A37549`)?

## Critérios de aceite

- `moduleId` criado e módulo cadastrado desativado, com o catálogo do item A3.
- `gestao-nucleos:manage` concedido.
- `HUB_JWT_SECRET` e Sandbox entregues por canal seguro.
- Resposta sobre o padrão visual (item C).

## Resposta do dono

**2026-11-26 — Substituído, sem execução.** Processado pelo connect (subagente, a pedido do Victor Santos).

O próprio solicitante pediu o encerramento no pedido que o substitui:
[[2026-11-11-connect-submodulo-nucleos-portal-gestao]]. Pelo ADR-0006 do `gestao-nucleos`, Núcleos virou
submódulo do `portal-gestao`, então nada deste pedido foi feito:

- nenhum `hubModules/gestao-nucleos` criado, e `gestao-nucleos:manage` não foi concedido;
- `HUB_JWT_SECRET` e Sandbox: não se aplicam. O portal já roda no `vnt-trader-rf` e usa o mesmo segredo do hub;
- item C (padrão visual): ficou sem objeto, porque o módulo próprio não vai existir. Se a dúvida continuar valendo
  para o Portal Gestão, ela entra num pedido novo.

Sem escrita, sem changelog e sem rollback.
