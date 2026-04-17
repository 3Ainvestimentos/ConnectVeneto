# Hardening do endpoint `/api/rss`

## Contexto

A rota `src/app/api/rss/route.ts` agrega feeds RSS publicos (InfoMoney) para a dashboard.
Historicamente usava `rss-parser`.`parseURL()`, que executa fetch interno sem passar
pela camada `safeFetch` do projeto. Isso deixava um residual pequeno porem real de:

- SSRF (se allowlist fosse relaxada)
- DoS via upstream inflado
- Falta de timeout uniforme
- Falta de validacao de `content-type`

## O que foi corrigido

1. Substituimos `parser.parseURL(feedUrl)` por `parser.parseString(xmlText)`.
2. O `xmlText` e obtido via `safeFetch` com:
   - `allowedHosts = ['www.infomoney.com.br']`
   - `timeoutMs = 6000`
   - `Accept` e `User-Agent` explicitos
3. Limite de body `MAX_FEED_BODY_BYTES = 2 MB`:
   - rejeita upstream que anuncia `content-length` maior que o limite
   - rejeita upstream que envia body acima do limite mesmo sem header
4. Validacao de `content-type`: apenas `xml`, `rss`, `atom` ou `text/plain`.
5. Erros convertidos em `OutboundHttpError` uniforme, retornando 502 ao cliente.
6. Logs via `logSecurityEvent` (ja com redaction + nivel configuravel pelo Bloco 4).

## Hipoteses de ataque mitigadas

- Atacante que consegue gravar URL de feed em `systemSettings` consegue transformar o endpoint em vetor SSRF.
  - Mitigado por `safeFetch` + allowlist dupla (checagem local `isAllowedFeedUrl` e allowlist do `safeFetch`).
- Upstream mal-configurado envia body gigante e trava o parser XML.
  - Mitigado por limite de body.
- Atacante posta conteudo nao-XML no caminho do feed.
  - Mitigado por validacao de content-type.

## Testes adicionados

Em `src/app/api/__tests__/routes.test.ts`:

- Upstream com status 500 retorna 502 e nao chama parser.
- Upstream com body acima do limite retorna 502 e nao chama parser.
- Fluxo feliz continua funcionando (dois feeds combinados e ordenados).

## Risco residual aceito

- `rss-parser` continua em uso para o XML ja em memoria. Advisories futuros contra o
  parser XML devem ser monitorados via `npm audit`. Atualmente nao ha advisory aberto.
- Se a allowlist for expandida, revisar este documento e adicionar novos hosts
  tanto em `ALLOWED_RSS_HOSTS` quanto em `safeFetch`.

## Proximos passos sugeridos (nao urgentes)

- Monitorar CVEs de `rss-parser`.
- Considerar cache de resposta com revalidate para reduzir chamadas externas.
- Considerar mover a lista de feeds permitidos para `systemSettings` (com regra restrita
  de escrita), caso seja necessario flexibilizar no futuro.
