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
  piloto). PR #57: assistentes recuados abaixo do comercial (`groupAssistants`) e Perfil/Estrutura
  sem trilha. Próximas levas: Diretoria fixa/realce do caminho, link `?unidade=`, linhas em SVG, busca
  no desenho, teclado. Aguardando feedback. (Merge 4b3fcb8 não disparou a Vercel; push novo resolveu.)
- 2026-10-22 — 🟢 PR #59: Notícia/Aviso/Evento com botões e regras próprias (`kind`, `postKind`,
  `normalizePostInput`); Publicações no menu; sem "Voltar"; menu recolhe <1280px; embeds sempre tela
  cheia. 🟢 PR #61: acesso pessoa a pessoa com tela nova (perfis ADR 0005 dormentes); cadastro sem Eixo/Área/Segmento/Líder/Equipe/Liderança; Área/Equipe/Líder derivados do organograma (59 gravados). Eixo não é mais editado: FAB/Auditoria filtram axis=Comercial. PR #62: eventos só na Agenda (fora de /publicacoes e do Resumo), Publicações fora do menu, ordem das unidades em Editar estrutura; relacionamento@ com inicio:view para teste. PR #63: equipes adicionais (`extraUnitIds`); Patrick em CX + Marketing. PR #64: "Excluir evento" à vista + lista da equipe em colunas. PR #65: Agenda sem os eventos do Google Agenda (desligado a pedido; religar = SHOW_COMPANY_CALENDAR em AgendaCard.tsx). PRs #66/#67: responsável mostra só o cargo no organograma. PR #70: botão "Erros e sugestões" no menu (padrão BotaoErrosESugestoes dos módulos; /api/feedback, coleção connectFeedback; super admin responde na própria janela); "Guias e FAQ" fora do menu (SHOW_GUIDES). 🟢 **PR #71: nova Home para todos** (inicio/pessoas accessMode all; login → /inicio; Resumo diário no lugar do Daily Fin).
- 2026-10-21 — Pendências de dados: campo Eixo só tem lixo; Área Comercial e Canal 3ARiva sem
  responsável; team vazio (birthDate/admissão importados em 22/10, falta Fernanda Adami); confirmar o nome "Operações" (Corporativo virou "Estratégia e Governança").
