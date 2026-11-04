---
tipo: pedido
solicitante: crm-legal
autor: Victor Santos
alvo: connect
data: 2026-10-27
tipo-pedido: modulo-connect
prioridade: normal
status: concluido
substitui: assistente-comercial/vault/pedidos/enviados/2026-10-19-permissoes-legal-no-modulo-atividade-comercial.md
---

# Pedido — Cadastrar o CRM do Legal como módulo `legal-advisory`

## Contexto

O CRM do Legal Advisory saiu do painel da Atividade Comercial para um app próprio (`crm-legal`,
ADR-0002 de lá), lançado em separado para não dividir deploy com o painel comercial. **Este pedido
substitui o de 19/10** do assistente-comercial (`atividade-comercial:legal` e `:legal:manage`), que
fica sem efeito: o Legal passa a ser um módulo próprio.

O lado do app está pronto e testado contra o hub simulado (segredo de teste): `/embed`, `hub-auth.ts`
canônico (v1.2), `POST /api/hub-session` conferindo `iss: connect-veneto` e `aud: legal-advisory`,
renovação a cada 10 min, `CV_MODULE_READY`, CSP `frame-ancestors 'self' https://connect.venetomfo.com.br`
e nenhum `X-Frame-Options`. Detalhes em `crm-legal/docs/connect-modulo.md`.

## O que precisa

1. **Cadastrar o módulo em Admin → Módulos, DESATIVADO** até o App Service existir (o Victor avisa a URL):

   | Campo | Valor |
   |---|---|
   | `id` / `slug` | `legal-advisory` |
   | `label` | Legal Advisory |
   | `description` | CRM do Legal: grupos atendidos, estrutura, biblioteca jurídica e rotinas |
   | `iconName` | `Scale` |
   | `url` | URL do App Service novo (a definir; sugestão de nome `vnt-crm-legal`) |
   | `embedPath` | `/embed` |
   | `accessMode` | `explicit` |
   | `permissionCatalog` | `[{ key: "legal-advisory:view", label: "Acessar" }, { key: "legal-advisory:manage", label: "Head do Legal" }]` |
   | `adminPermissions` | `["legal-advisory:view", "legal-advisory:manage"]` |
   | `layout` | `fullscreen` |

   Papel no app: `superadmin` = admin; `legal-advisory:manage` = head (vê a equipe e as
   Configurações); acesso sem `:manage` = advogada (só os grupos dela).
2. **Mesmo `HUB_JWT_SECRET`** do hub para a App Setting do app novo, pelo canal seguro de sempre.
3. **Acesso**: só `victor.santos@venetomfo.com.br` até o teste em produção; depois a equipe do Legal
   (o Victor passa a lista), com `:manage` só para o head.

## Retorno esperado

Status no próprio arquivo e o id do módulo confirmado.

## Resposta do dono

2026-11-04 — **Em andamento: módulo no ar e ativo, visível só ao Victor; falta o segredo no app e o teste.**
Id do módulo confirmado: **`legal-advisory`** (slug e rota `/legal-advisory`).

- **Item 1:** `hubModules/legal-advisory` gravado pelo `scripts/add-legal-advisory-module.mjs`
  (`--apply --acessos`, depois `--apply --ativar`): embedded, `https://vnt-crm-legal.azurewebsites.net` + `/embed`,
  `accessMode: explicit`, `layout: fullscreen`, `skeletonTheme: light`, `noZoom`, `adminPermissions`
  `[legal-advisory:view, legal-advisory:manage]`, **`enabled: true`**. Três ajustes em relação ao pedido:
  - **Ícone `ShieldCheck`**: `Scale` não está em `MODULE_ICONS` (`src/components/layout/module-icons.ts`) e
    apareceria como o ícone genérico (Puzzle). Trocar por `Scale` é um PR de duas linhas + deploy, como o #74.
  - **`order` 14**, último do menu (abaixo do `hub-cadastro`, 13). O 10 sugerido é do `portal-repasse`.
  - **`permissionCatalog` só com `legal-advisory:manage` (Head do Legal)**: o `:view` é a coluna de acesso
    própria da página `/legal-advisory/admin` (o `AccessManager` tira o `:view` do catálogo), como no
    `portal-cliente` e na `atividade-comercial`.
  - O slug não está em `RESERVED_SLUGS` e a CSP do hub já cobre o domínio (`frame-src https://*.azurewebsites.net`),
    então **não houve PR nem deploy do Connect**.
- **Item 3 (acesso):** só `victor.santos@venetomfo.com.br`, com `legal-advisory:view` e `legal-advisory:manage`
  (testa como head). Com `explicit`, mais ninguém vê o item no menu. A equipe do Legal entra depois, com a lista do
  Victor (`:manage` só para o head) — pode ser pela própria `/legal-advisory/admin` ou por pedido `acesso-connect`.
- **Item 2 (`HUB_JWT_SECRET`):** não passou por aqui. O domínio `seguranca` está gravando a App Setting do
  `vnt-crm-legal` a partir da App Setting do `vnt-debriefing-reunioes` (é o mesmo segredo do hub para todos os
  módulos). Até isso terminar, o handshake recusa o token e o iframe não sai do skeleton.
- **Para fechar:** com o segredo no `vnt-crm-legal`, o Victor abre `connect.venetomfo.com.br/legal-advisory`
  (Chrome e iPhone) e confere que o app sai do skeleton por `CV_MODULE_READY`, sem tela de login, e que ele
  entra como head (vê a equipe e as Configurações).
- **Rollback:** `enabled: false` (ou apagar `hubModules/legal-advisory`) e tirar `modulePermissions.legal-advisory`
  do Victor.
- Changelog: `connect` vault/changelog/2026-11.md (2026-11-04).

2026-11-04 — **Concluído.** O Victor testou `connect.venetomfo.com.br/legal-advisory` e o módulo funciona (handshake,
sessão e telas). Segue visível só para ele; a liberação para a equipe do Legal entra por `/legal-advisory/admin` ou por
um pedido `acesso-connect`, com `legal-advisory:manage` só para o head.
