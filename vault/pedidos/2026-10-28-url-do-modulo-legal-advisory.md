---
tipo: pedido
solicitante: crm-legal
autor: Victor Santos
alvo: connect
data: 2026-10-28
tipo-pedido: modulo-connect
prioridade: normal
status: concluido
complementa: 2026-10-27-modulo-legal-advisory.md
---

# Complemento — URL do módulo `legal-advisory`

O App Service do CRM do Legal está no ar: **`https://vnt-crm-legal.azurewebsites.net`**. É o valor do campo
`url` do registro pedido em `2026-10-27-modulo-legal-advisory` (`embedPath` `/embed`).

Conferido em 2026-10-28: `/embed` responde 200 com `Content-Security-Policy: frame-ancestors 'self'
https://connect.venetomfo.com.br` e sem `X-Frame-Options`; fora do Connect, as páginas mandam para
`/fora-do-connect` e a API responde 401.

Falta só o `HUB_JWT_SECRET` (pelo canal seguro, para o Victor gravar na App Setting do `vnt-crm-legal`);
sem ele o handshake recusa todo token. O módulo pode continuar desativado até o Victor testar.

## Resposta do dono

2026-11-04 — **Concluído.** `hubModules/legal-advisory` tem `url: https://vnt-crm-legal.azurewebsites.net` e
`embedPath: /embed`. Conferido de novo hoje: `/embed` responde 200 com `frame-ancestors 'self'
https://connect.venetomfo.com.br` e sem `X-Frame-Options`; a CSP do hub já libera `*.azurewebsites.net`. O
acompanhamento (segredo e teste) segue no pedido [[2026-10-27-modulo-legal-advisory]].
