---
tipo: pedido
solicitante: area-logada
autor: Victor Santos
alvo: connect
data: 2026-10-26
tipo-pedido: modulo-connect
prioridade: normal
status: aberto
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

_(preenchido por quem processa: o que foi feito, rollback, links para changelog)_
