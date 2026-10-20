# Hub de Comunicação: integração e substituição das Notícias

Plano para a nova Home e a página Publicações substituírem o feed de Notícias e a Home atual.
Vocabulário em [CONTEXT.md](../CONTEXT.md). Decisões de 2026-10-15, revistas em 2026-10-18 (Home sem feed, ver abaixo e [ADR 0003](adr/0003-home-sem-feed.md)).

## Decisões

| Tema | Decisão |
|---|---|
| Endereço final | `/dashboard` passa a ser a nova Home. `/inicio` vira redirect. |
| Lançamento | Piloto em `/inicio` só para algumas pessoas, convivendo com a Home atual. |
| Notícias existentes | Migrar para Publicações já no piloto; **congelar `newsItems` só depois** dos testes e da transição. |
| Onde publicar | Só no feed ("Nova publicação"). A aba Notícias do admin vira **Publicações** (gestão: editar, arquivar, listar). |
| Home × feed (2026-10-18) | A Home não tem feed: mostra Avisos, To-do, Agenda, Pessoas e Indicadores. As Notícias vão para o Resumo diário e para `/publicacoes`. |

## Hoje (o que depende do que)

- `/dashboard`: redirect pós-login (`AuthContext`), 12 guards/layouts, logo do `Header`, item "Painel Inicial" em `hubModules`, enquetes com `targetPage: '/dashboard'`.
- `newsItems`: `/news` (`NewsFeedClient`), widget `NewsHighlights` na Home, aba Notícias do admin (`ManageNews` → `/api/admin/news`), upload em `noticias/` no Storage.
- Wireframe atual: `/inicio` lê `newsItems` por um adaptador (`src/lib/hub-mock/news-adapter.ts`); o resto é mock em localStorage.

## Fase 1 — Piloto em `/inicio`

Objetivo: um grupo pequeno usa a nova Home com dados reais, sem afetar ninguém.

1. **Acesso do piloto.** Criar o módulo interno `inicio` em `hubModules` com acesso explícito (estender `internalModuleSchema` com `accessMode: 'all' | 'explicit'`, como já existe nos embarcados). O RH libera `inicio:view` por pessoa na tela de permissões de módulo que já existe. Quem não tem acesso e abre `/inicio` cai em `/dashboard`.
2. **Coleções novas** (escrita só por API route + Admin SDK, como Notícias hoje):
   - `hubChannels` — nome, dono, `publisherUids`, semeado.
   - `hubPosts` — canal, autor (`authorUid`), título, texto, importância, `highlightUntil`, `expiresAt`, mídia (`coverUrl`, `storagePath`, vídeo), evento, enquete, `status`, `createdAt`, `legacyNewsId`.
   - `hubPosts/{id}/comments` (com `relevant`), `hubPosts/{id}/reactions/{uid}`, `hubPosts/{id}/rsvp/{uid}`.
3. **Migração de Notícias** — script idempotente `scripts/migrate-news-to-posts.mjs`: cada `newsItems` publicado vira `hubPosts` no canal Institucional, autor "Comunicação Vêneto", `legacyNewsId = id`, destaque → Importante. Roda quantas vezes precisar (atualiza pelo `legacyNewsId`). `newsItems` **continua editável** nesta fase.
4. **Sincronização durante o piloto.** Enquanto o RH ainda publica pela aba Notícias, a API de Notícias também grava o espelho em `hubPosts` (mesmo `legacyNewsId`). Assim o piloto vê tudo e ninguém publica duas vezes.
5. **Feed real.** Trocar o mock de posts por `hubPosts` (TanStack Query), com ranking (`ranking.ts`), comentários relevantes e reações persistidos. Link de publicação: `/publicacoes?p=<id>` (notificações, Resumo, "Copiar link"); na Home, Avisos e Agenda abrem a publicação num diálogo. `/inicio?p=<id>` redireciona para `/publicacoes?p=<id>` (notificações antigas).
6. **Publicar pelo feed.** `POST /api/hub/posts` com a regra: Comunicação (`canManageContent`) em qualquer canal; demais só nos canais em que estão em `publisherUids`. Upload reaproveita o fluxo de `noticias/` (pasta `publicacoes/`).
7. **Notificações** pela Central existente (`src/lib/notifications/server.ts`): Importante publicado, menção, comentário marcado como relevante (para quem comentou).
8. **Pessoas (2026-10-20, dados reais).** `collaborators` ganhou os dados oficiais do Perfil (`team`, `leaderIdVeneto` — ADR 0001 —, `birthDate`, `admissionDate`, `careerHistory`), mantidos pelo RH no cadastro e em lote pela planilha "Atualizar perfis" (`POST /api/admin/collaborators/profile-import`, atualiza por ID, com prévia); e os dados pessoais (`bio`, `responsibilities`, `interests`, `phone`, `googleChat`), gravados pela própria pessoa em `PATCH /api/me/profile` (só esses campos). Gestor: `leaderIdVeneto`; sem ele, o Hub casa o nome de `leader` quando é único (`src/lib/hub/people.ts`); `scripts/migrate-leader-to-idveneto.mjs` grava o ID para quem casa e gera CSV dos casos para o RH. Viagens: `leaderTrips` (autosserviço pela Home e pelo Perfil; a pessoa é achada pelo nome ou por quem registrou). Férias: `vacation_requests` aprovadas (o "+ férias" leva ao fluxo atual, só para quem tem a permissão de férias). Aniversário do dia: `birthDate`. Mock removido (`src/lib/hub-mock`).

9. **Resumo diário no lugar do Daily Fin (só piloto).** O `AppLayout` monta `HubDigestModal` para quem tem o módulo `inicio` e `DailyRssModal` para os demais. O "visto" fica em `hubDigestState/<email>` (`lastSeenAt`), então vale entre dispositivos; o "uma vez por dia" é local (`hubDigestShownDate`). Desligar o Daily Fin para todos fica para a Fase 2.

10. **Home sem feed (2026-10-18, layout de 2026-10-19).** `/inicio`, duas colunas que terminam na mesma altura (o último card de cada uma estica). Principal: To-do (`TodoCard`: tarefas do TrackFlow em "para você responder" e "suas solicitações"), Pessoas e equipes (Viagens e Férias, com a faixa "Hoje é o aniversário de…" só quando há aniversariante), Publicações (`PublicacoesFeedCard`: mosaico com as 3 Notícias mais recentes dos canais seguidos, no estilo dos destaques do Painel Inicial; abre a notícia num diálogo; "ver todas" leva a `/publicacoes`). Lateral: Indicadores Estratégicos, Avisos (`isHighlighted`, por prazo; "Novo aviso" para quem publica) e Agenda e Eventos (publicações com evento + `/api/calendar`; seletor de período, padrão 60 dias). Sem botões no topo e sem card de Mercado. O feed completo fica em `/publicacoes` (chip "Todos" = seguidos + Avisos). Resumo com imagem e modo sob demanda (`?since` aceito de qualquer pessoa do piloto, até 30 dias).

**Sai do piloto quando:** o grupo usa por 2–4 semanas, o RH publicou só pelo feed por pelo menos 2 semanas e não há diferença entre `newsItems` e `hubPosts`.

## Fase 2 — Troca da Home

1. `/dashboard` renderiza a nova Home; `/inicio` redireciona para `/dashboard` (mantém links do piloto). `/publicacoes` continua como está.
2. `hubModules`: "Painel Inicial" → **Início**; módulo `inicio` desativado; entradas fixas do wireframe saem do `AppLayout`.
3. `/news` redireciona para `/publicacoes?canal=institucional`; `/news?id=` → `/publicacoes?p=<post>` via `legacyNewsId`.
4. Aba Notícias do admin vira **Publicações** (lista, editar, arquivar, mudar destaque) lendo `hubPosts`.
5. Remover `NewsHighlights`, `NewsFeedClient` e o espelho da API de Notícias.

## Fase 3 — Congelar Notícias

1. Última execução do script de migração.
2. `firestore.rules`: `newsItems` só leitura (nem super admin escreve); `/api/admin/news` responde 410.
3. Remover `NewsContext` e `ManageNews` depois de um ciclo sem uso. Manter os dados de `newsItems` como histórico.

## Riscos e cuidados

- **Duas fontes no piloto:** o espelho da API de Notícias (Fase 1.4) é o que evita divergência; o script é a rede de segurança.
- **Permissões:** nada de escrita direta pelo cliente em `hubPosts` (as rules não leem flags do colaborador); tudo por API route, como Notícias.
- **Imagens:** `next.config` já libera `firebasestorage.googleapis.com`; manter as URLs migradas como estão.
- **Telemetria:** `/inicio`, `/pessoas` e `/publicacoes` registrados em `app-page-routes.ts`.
