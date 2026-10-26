---
tipo: pedido
solicitante: area-logada
autor: Victor Santos
alvo: connect
data: 2026-10-26
tipo-pedido: modulo-connect
prioridade: normal
status: em-andamento
---

# Pedido — Cadastrar a área logada como módulo `area-logada` (+ segredo do hub)

## Contexto

Os comerciais acompanham as carteiras dos clientes e validam os relatórios mensais na área
logada (`app.venetomfo.com.br`), um site separado do Connect. A ideia é centralizar o espaço de
trabalho: a área logada passa a abrir **dentro do Connect** como módulo embarcado, e a visão
administrativa (validação de relatórios, e outras que virão) fica no Connect. O
`app.venetomfo.com.br` fica, com o tempo, só com a visão limpa de cliente.

O lado da área logada está pronto em PR, seguindo o protocolo v1.5 (padrão A, Bearer em memória):

- [area-logada-cliente#200](https://github.com/venetomfo/area-logada-cliente/pull/200): rota
  `/embed/`, handshake (`hub-auth.ts` v1.2), `CV_MODULE_READY`, renovação, CSP
  `frame-ancestors 'self' https://connect.venetomfo.com.br` e nenhum `X-Frame-Options`.
- [backend-area-logada#131](https://github.com/venetomfo/backend-area-logada/pull/131): o portal
  é exportação estática, então a verificação do Module Token (R-04) é feita no backend Fastify,
  em `POST /api/v1/hub/session`. Ele confere `iss: connect-veneto` e `aud: area-logada` e acha o
  login da área logada pelo claim `email`.

O handshake já foi testado localmente contra um hub simulado, com o segredo de teste.

## O que precisa

1. **Liberar o slug `area-logada`.** Ele está em `RESERVED_SLUGS` de `src/config/modules.ts`, que
   é resquício da página `/area-logada` removida em `8776b9c`. Também é preciso tirar o redirect
   `/rankings → /area-logada` do `next.config.ts`. **Isso exige deploy do hub.**
2. **Cadastrar o módulo em Admin → Módulos, DESATIVADO**, com estes campos:

   | Campo | Valor |
   |---|---|
   | `id` / `slug` | `area-logada` |
   | `label` | Área Logada |
   | `description` | Carteiras dos clientes e validação dos relatórios mensais |
   | `iconName` | `BriefcaseBusiness` (sugestão) |
   | `url` | `https://app.venetomfo.com.br` |
   | `embedPath` | `/embed/` (com a barra final: o portal é export estático com `trailingSlash`) |
   | `accessMode` | `explicit` |
   | `permissionCatalog` | `[{ key: "area-logada:view", label: "Acessar" }]` |
   | `adminPermissions` | `["area-logada:view"]` |
   | `layout` | `fullscreen` |
   | `skeletonTheme` | vazio (o portal é branco e navy, tons frios) |

   As permissões internas, como o que cada comercial vê e se pode liberar relatórios, continuam
   sendo da área logada (`permissoes_usuario`). Do Connect só se usa o acesso ao módulo.
3. **`HUB_JWT_SECRET` ao Victor**, pelo canal seguro que o time de plataforma já usa para
   segredos (a Vêneto não usa Bitwarden). Ele vai direto para a App Setting do
   `backend-area-logada`. Nunca por chat ou e-mail.
4. **Liberar `area-logada:view` só para `victor.santos@venetomfo.com.br`** até o teste em Chrome
   e Safari do iPhone. A liberação aos comerciais vem num pedido seguinte, tipo `acesso-connect`.

## Critérios de aceite

- `connect.venetomfo.com.br/area-logada` abre o portal para o Victor, e o módulo não aparece para
  mais ninguém.
- O handshake completa: o portal sai do skeleton por `CV_MODULE_READY` e não mostra tela de login.
- `?to=/portfolio` abre a página certa (deep link).
- O segredo foi entregue por canal seguro e não aparece em nenhum arquivo, commit ou nota.

## Resposta do dono

2026-10-26 — **Em andamento: itens 2 e 4 feitos; o item 1 aguarda o merge do PR e o item 3 depende de pessoa.**

- **Item 1 (slug + redirect):** [3Ainvestimentos/ConnectVeneto#73](https://github.com/3Ainvestimentos/ConnectVeneto/pull/73)
  tira `area-logada` de `RESERVED_SLUGS` e o redirect `/rankings → /area-logada`. Aguarda merge e
  deploy (Vercel). A CSP já cobre `app.venetomfo.com.br` (`frame-src *.venetomfo.com.br`), então
  ela não precisa mudar.
- **Item 2:** `hubModules/area-logada` foi gravado **desativado** (`enabled: false`) via
  `scripts/add-area-logada-module.mjs --apply`, com os campos do pedido: embedded, ordem 13,
  `https://app.venetomfo.com.br` + `/embed/`, explicit, fullscreen, sem `skeletonTheme`, catálogo
  `area-logada:view` (Acessar), admin `area-logada:view`. **Uma mudança:** o ícone é `Briefcase`,
  porque `BriefcaseBusiness` não está no `iconMap` do hub e apareceria como "?".
- **Item 4:** `area-logada:view` foi concedido só ao Victor (`--acessos`). Com `accessMode: explicit`,
  mais ninguém vê o módulo.
- **Item 3 (`HUB_JWT_SECRET`):** não foi entregue por aqui. O segredo não passa por chat nem pelo
  agente. O Victor copia o valor do `.env.local` do Connect (ou da env da Vercel) para a App
  Setting do `backend-area-logada`, pelo canal seguro.
- **Para fechar:** depois do deploy do #73, rodar
  `node --env-file=.env.local scripts/add-area-logada-module.mjs --apply --ativar`, que só faz o
  `enabled: true`. Em seguida, testar no Chrome e no Safari do iPhone: o handshake e
  `/area-logada?to=/portfolio`, que chega ao portal como `/embed/?next=%2Fportfolio`.
  **Atenção:** o hub repassa o deep link como `?next=` (protocolo §5.3), e não como `?to=`.
- **Rollback:** apagar `hubModules/area-logada` (ou deixar `enabled: false`), tirar
  `modulePermissions.area-logada` do Victor e reverter o #73.
- Changelog: `connect` vault/changelog/2026-10.md (2026-10-26).

2026-10-26 (tarde): **lado do hub concluído.** O #73 foi mergeado e o deploy de produção terminou
às 15:41 (`/rankings` não redireciona mais). `hubModules/area-logada` agora está com
`enabled: true` (`--apply --ativar`). Ele aparece só para o Victor.
**Ainda falta, do lado da área logada:** o
[area-logada-cliente#200](https://github.com/venetomfo/area-logada-cliente/pull/200) está aberto, e
`https://app.venetomfo.com.br/embed/` responde 404. Até o merge e o deploy dele, o iframe mostra
erro. O backend#131 já está mergeado. Depois disso: colocar o `HUB_JWT_SECRET` na App Setting do
backend e testar no Chrome e no iPhone. O pedido fecha com o teste.
