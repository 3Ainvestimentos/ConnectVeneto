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
- 2026-10-21 — 🟢 **Organograma + estrutura real** (PRs #51, #52): 9 Áreas / 12 Equipes com
  responsável (lista do Victor); 10 ocultos no Hub (`hubHidden`: testes + 7 que saíram — acesso
  deles ao Connect **não** foi removido, pendente de decisão). Sócios no topo (Diretoria). Ver changelog.
- 2026-10-22 — 🟡 **Organograma v2/v3** (PRs #55, #56): visual "Organograma" em tela cheia, zoom
  flutuante, prévia no hover + modal central ao clicar, árvore no celular; sem rótulos Área/Equipe;
  sem o seletor liderança/estrutura; "Pessoas e equipes" no menu (`hubModules/pessoas`, acesso do
  piloto). Próximas levas: Diretoria fixa/realce do caminho, link `?unidade=`, linhas em SVG, busca
  no desenho, teclado. Aguardando feedback. (Merge 4b3fcb8 não disparou a Vercel; push novo resolveu.)
- 2026-10-21 — Pendências de dados: campo Eixo só tem lixo; Área Comercial e Canal 3ARiva sem
  responsável; birthDate/team vazios; confirmar o nome "Operações" (Corporativo virou "Estratégia e Governança").
