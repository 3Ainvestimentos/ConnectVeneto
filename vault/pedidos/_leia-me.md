# Inbox de pedidos — connect

> **Esta pasta é a INBOX; a OUTBOX é `enviados/`.** Pedido *deste* domínio para outro nasce em
> `vault/pedidos/enviados/` (via `/pedir`, nunca à mão), e ninguém edita arquivo de lá depois do push.

Outros domínios depositam pedidos aqui (um arquivo por pedido, modelo em
`<hub>/modelos/pedido.md.template`). Processe com `/processar-pedidos`: cada pedido executa sob os
guardrails do tier **médio** deste repo, atualiza o próprio status e gera entrada em
`vault/changelog/AAAA-MM.md`.

Tipos aceitos: `modulo-connect` (cadastrar/alterar módulo em `hubModules`, catálogo de permissões,
conceder `<modulo>:manage`), `segredo-hub` (entrega do `HUB_JWT_SECRET`, sempre por Bitwarden),
`sandbox`, `notificacoes` (teste ou ajuste da Central de Notificações), `acesso-connect` (permissão
de pessoa no Connect) e `outro`.
