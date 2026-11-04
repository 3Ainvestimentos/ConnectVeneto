---
tipo: pedido
solicitante: trackflow
autor: Victor Santos
alvo: connect
data: 2026-11-04
tipo-pedido: outro
prioridade: normal
status: em-andamento
---

# Pedido — Fluxos do TrackFlow na página Solicitações (/applications)

## Contexto

O TrackFlow tem **fluxos**: pedidos com etapas, SLA e acompanhamento (ADR-0008 do trackflow). O
primeiro em produção é o **SGT — Solicitações Gerais Tecnologia** (área Tecnologia e Dados), publicado
em 2026-11-04: Triagem → Execução → Validação de quem pediu.

Na auditoria de UX de 2026-10-23 (V11) o botão "Abrir ticket" saiu do TrackFlow, porque **a porta de
entrada dos pedidos é a página Solicitações do Connect**. A ponte nunca foi feita: hoje a página é a
lista fixa de `src/config/veneto-solicitacoes.ts` (Monday, Google Forms), e não há como abrir um SGT
pela interface. O Victor pediu essa ligação.

O lado TrackFlow está pronto na branch `feat/fluxos-no-connect` do trackflow (PR a seguir):

- **`GET /api/hub/fluxos`**, autenticado pelo hub JWT, mesmo contrato do `/api/summary` (issuer
  `connect-veneto`, audience `trackflow`, Bearer). Resposta:

  ```json
  { "fluxos": [
    { "id": "8E1297E1-…", "sigla": "SGT", "nome": "Solicitações Gerais Tecnologia",
      "descricao": null, "areaId": "B61A7CFC-…", "areaNome": "Tecnologia e Dados",
      "path": "/fluxos/8E1297E1-…/abrir" }
  ] }
  ```

  Já vem filtrada: só fluxos ativos e publicados que **esta pessoa** pode abrir, e só para quem está
  no piloto (`FLUXOS_ROLLOUT_EMAILS`: hoje Victor, Ana Daldegan e Maria Naves). Para os demais a lista
  vem **vazia**: o Connect não precisa de regra de acesso própria.
- **`/fluxos/<id>/abrir`** volta a existir como página do formulário de abertura, pensada para abrir
  no iframe pelo deep link que o Connect já tem (`/trackflow?to=<path>`, o mesmo do sino). Ao enviar,
  a pessoa cai no ticket recém-aberto, dentro do mesmo iframe.

## O que precisa

1. **Proxy** `src/app/api/modules/trackflow/fluxos/route.ts`, cópia do
   `src/app/api/modules/trackflow/summary/route.ts` trocando o destino para
   `${TRACKFLOW_URL}/api/hub/fluxos`. Mesmo JWT de 60 s, mesmo `requireCorporateUser`. Se der vontade,
   extrair a assinatura do token para um helper comum aos dois — fica a critério do dono.

2. **Cartões dinâmicos** em `src/components/applications/VenetoSolicitacoesHub.tsx`:
   - buscar `/api/modules/trackflow/fluxos` com o `idToken` do Firebase (como o
     `TrackFlowSummary` faz);
   - cada fluxo vira um `SolicitationItemExternal`:
     `{ kind: "external", title: nome, subtitle: descricao ?? "Pedido com acompanhamento no TrackFlow",
     href: \`/trackflow?to=${encodeURIComponent(path)}\`, newTab: false, trackingKey: \`trackflow_${sigla}\` }`
     (`newTab: false` porque o link é interno — o padrão atual abriria em aba nova);
   - agrupar por `areaNome`: se bate com o título de uma área existente (comparar sem acento e sem
     caixa), o cartão entra nela; senão nasce uma área nova
     `{ id: \`trackflow-${areaId}\`, title: areaNome, icon: <um ícone que o getIcon conheça>, items }`.
     O SGT hoje cria a área **"Tecnologia e Dados"**, que não existe na lista fixa;
   - a busca da página já percorre `sortedAreas`, então basta montar a lista mesclada antes dela;
   - falha ou demora na chamada **não pode** afetar a lista fixa: sem resposta, a página fica como
     está hoje (sem erro na tela).

3. Opcional: o texto do cabeçalho da página diz que o acompanhamento "fica no canal correspondente,
   pois esta página apenas direciona aos links". Para os fluxos do TrackFlow o acompanhamento é no
   próprio TrackFlow ("Meus tickets"); ajustar se fizer sentido.

## Critérios de aceite

- Logado como Victor, Ana Daldegan ou Maria Naves, `/applications` mostra a área "Tecnologia e Dados"
  com o cartão "Solicitações Gerais Tecnologia".
- Clicar abre o formulário do SGT **dentro** do Connect (iframe do TrackFlow), não em aba nova; enviar
  leva ao ticket aberto.
- Logado como qualquer outra pessoa, a página é idêntica à de hoje (nenhuma área ou cartão novo).
- Com o TrackFlow fora do ar, a página carrega normalmente com a lista fixa.
- Publicar um fluxo novo no TrackFlow faz o cartão aparecer sem deploy do Connect.

## Resposta do dono

**2026-11-04 (connect): implementado em PR, aguardando merge e deploy.**

- **PR:** https://github.com/3Ainvestimentos/ConnectVeneto/pull/76 (branch
  `feat/fluxos-trackflow-em-solicitacoes`, a partir de `origin/main`, commit `5290ef8`).
- **Proxy** `GET /api/modules/trackflow/fluxos` → `${TRACKFLOW_URL}/api/hub/fluxos`, com o mesmo hub JWT de
  60 s e o mesmo `requireCorporateUser`, e timeout de 8 s. A assinatura do token e o encaminhamento
  saíram para `src/lib/trackflow/hub-proxy.ts`, que o `/summary` também passou a usar. O contrato
  dele não mudou; a única diferença é que falha de rede agora volta 504 em vez de 500.
- **Mesclagem** em `src/lib/trackflow/fluxos.ts` (funções puras com testes). O arquivo valida a resposta
  e descarta entradas incompletas ou com `path` inseguro. Cada fluxo vira o cartão especificado:
  `/trackflow?to=<path>`, `newTab: false`, `trackingKey: trackflow_<sigla>`. O cartão entra na área de
  mesmo título (a comparação ignora acento e caixa). Se não houver, nasce a área `trackflow-<areaId>`
  no fim da lista, com o ícone `Laptop`. Um cartão com o mesmo `trackingKey` já cadastrado em
  Admin › Conteúdo não é duplicado. A lista mesclada é só de exibição e nunca é salva.
- **Página:** `useTrackFlowFluxos` (React Query, sem retry) transforma qualquer falha em lista vazia.
  A página não espera essa busca, e os cartões entram quando a resposta chega. A busca da página
  também acha os cartões novos. O cabeçalho de `/applications` agora diz que os pedidos do TrackFlow
  são acompanhados em "Meus tickets".
- **Verificação:**
  - `typecheck:gate`: sem erros.
  - `lint`: o único aviso é um que já existia em `AuthContext.tsx`, vindo de `main`. Os arquivos novos
    passam limpos.
  - `test:ci`: 226 testes passam, 20 deles novos. Duas suítes (`ManageCollaborators.import`,
    `WorkflowSubmissionModal`) não sobem sem `.env` (`auth/invalid-api-key`) e não tocam este código.
  - `build`: compila e passa nos tipos. Para no prerender por falta de `.env` do Firebase.
  - Sem teste manual no navegador.
- **Rollback:** fechar o PR, ou reverter o merge. Não há dado nem configuração de produção envolvidos.
- **Falta, com aprovação:** merge do PR e deploy do Connect. Depois do deploy, conferir os critérios de
  aceite logado como alguém do piloto e como alguém de fora dele. A entrada no
  `vault/changelog/` fica para quando o merge e o deploy forem aplicados.
