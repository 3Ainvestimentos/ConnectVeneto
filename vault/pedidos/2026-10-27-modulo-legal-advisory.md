---
tipo: pedido
solicitante: crm-legal
autor: Victor Santos
alvo: connect
data: 2026-10-27
tipo-pedido: modulo-connect
prioridade: normal
status: aberto
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
