---
tipo: nota
atualizado: 2026-10-15
tags: [hot-cache]
---

# 🔥 Cache quente — estado do mundo

> Máximo ~10 bullets. Ao adicionar um novo, remova o mais antigo. Nunca contém segredos.

- 2026-10-15 — 🟢 **Domínio `connect` adotado** (tier médio). Até hoje os pedidos ao "dono do
  ConnectVeneto" (cadastro de módulo, `HUB_JWT_SECRET`, Sandbox, notificações) eram só por canal
  humano. Os do `projeto-trader-rf` (itens A e B do pedido de 15/10 ao db-guardian) seguem com o
  Victor.
- 2026-10-15 — 🟡 **Hub de Comunicação Interna** (nova Home): Fase 1 pronta na branch
  `feat/hub-fase1` (local, não publicada). Feed real no Firestore (`hub*`), API `/api/feed`, piloto
  pelo módulo `inicio` (accessMode explicit), espelho Notícias→feed. Já gravado em produção: regra
  `publicacoes/` no Storage, módulo `inicio`, 7 canais, 8 Notícias migradas (ver changelog). Falta:
  PR/deploy, escolher as pessoas do piloto, pessoas/viagens/férias reais. Plano em
  `Downloads/ConnectVeneto/ConnectVeneto/docs/hub-comunicacao-integracao.md`. Azure fica para a
  migração do Connect.
