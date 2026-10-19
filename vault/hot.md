---
tipo: nota
atualizado: 2026-10-19
tags: [hot-cache]
---

# 🔥 Cache quente — estado do mundo

> Máximo ~10 bullets. Ao adicionar um novo, remova o mais antigo. Nunca contém segredos.

- 2026-10-15 — 🟢 **Domínio `connect` adotado** (tier médio). Até hoje os pedidos ao "dono do
  ConnectVeneto" (cadastro de módulo, `HUB_JWT_SECRET`, Sandbox, notificações) eram só por canal
  humano. Os do `projeto-trader-rf` (itens A e B do pedido de 15/10 ao db-guardian) seguem com o
  Victor.
- 2026-10-19 — 🟢 **Hub de Comunicação Interna** em produção (PRs #29–#42): Home `/inicio` sem feed
  (To-do, Pessoas e equipes, Publicações | Indicadores Estratégicos, Avisos, Agenda e Eventos) e
  `/publicacoes`. Ainda com dados de exemplo: Pessoas/viagens/férias/aniversários e Indicadores.
  Em andamento: dados reais e `/pessoas` com organograma (ADR 0001). Piloto ainda sem `inicio:view`.
- 2026-10-19 — pedido aberto → dados-estrategicos: API com AuM/Churn/ROA para a Home
  (`dados-estrategicos/vault/pedidos/2026-10-19-api-indicadores-home-connect.md`).
- 2026-10-19 — ⚠️ **Rule de `collaborators`** deixa a pessoa editar o próprio doc sem restrição de
  campo (pode se dar `permissions`). Correção proposta junto com `/pessoas`; deploy só com aprovação.