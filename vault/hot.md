---
tipo: nota
atualizado: 2026-10-21
tags: [hot-cache]
---

# 🔥 Cache quente — estado do mundo

> Máximo ~10 bullets. Ao adicionar um novo, remova o mais antigo. Nunca contém segredos.

- 2026-10-15 — 🟢 **Domínio `connect` adotado** (tier médio). Até hoje os pedidos ao "dono do
  ConnectVeneto" (cadastro de módulo, `HUB_JWT_SECRET`, Sandbox, notificações) eram só por canal
  humano. Os do `projeto-trader-rf` (itens A e B do pedido de 15/10 ao db-guardian) seguem com o
  Victor.
- 2026-10-21 — 🟢 **Hub com dados reais** (PRs #43–#50): viagens, férias (`hubVacations`),
  Indicadores Estratégicos (API do dados-estrategicos, pedido concluído), gestor por ID (66/84) e
  estrutura `orgUnits` (18 Áreas sem responsável, ADR 0004). Piloto ainda sem `inicio:view`.
- 2026-10-21 — ✅ Rule de `collaborators` endurecida (PR #45, ruleset `a9db4fa4…`).
- 2026-10-21 — 🟡 **Organograma refeito** (PR #51, aguardando merge do Victor): vista "Por
  liderança" navegável e estrutura em cartões. Em produção a vista por pessoa estava **vazia**
  porque Carlos Pessoa e Fernando Damasceno são gestor um do outro (agora o ciclo vira o topo).
- 2026-10-21 — Dados para o RH: campo Eixo só tem lixo ("-", "--", "IA", "ti"); contas de teste
  no cadastro ("Desenvolvedor", "ti", "Teste Inteligência Comercial"); 18 pessoas sem gestor
  (CSV `gestores-para-revisar-2026-10-21.csv`); Áreas sem responsável; birthDate/team vazios.
