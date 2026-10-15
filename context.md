# context.md — connect

> Documento fundador do domínio. Criado em 2026-10-15 na adoção do framework veneto-agentes.
> O glossário do app (Canal, Publicação, Publicador…) fica em
> `Downloads/ConnectVeneto/ConnectVeneto/CONTEXT.md`; este arquivo não o duplica.

## O que é este domínio

O ConnectVeneto: a intranet de todos os colaboradores e o hub onde os módulos internos entram
embarcados. Next.js 15 com Firebase (Auth Google, Firestore, Storage, Admin SDK nas API routes),
hospedado fora da Azure. O app fica em `Downloads/ConnectVeneto/ConnectVeneto/`.

## Por que existe / contexto de negócio

É o ponto de entrada do dia a dia da Vêneto: comunicação interna, documentos, solicitações e o
acesso aos sistemas (TrackFlow, Dados Estratégicos, Portal do Cliente e outros), cada um com a
própria permissão por pessoa. Outros domínios dependem do Connect para três coisas: cadastro de
módulo e permissões, o segredo do hub (`HUB_JWT_SECRET`) e a Central de Notificações. Até esta
adoção, esses pedidos só tinham canal humano ("dono do ConnectVeneto, sem domínio no registro",
registrado pelo db-guardian em 2026-10-15).

## Decisões de adoção (2026-10-15)

- Tier de criticidade: **médio** — produto web usado pela empresa toda; código é livre, e deploy,
  rules, dados de produção no Firestore, segredos e infra são aprovados.
- Vault de memória em `vault/` (hot.md, decisões, sessões, changelog, pedidos, runbooks).
- Registro no hub: `C:\Users\victor.santos\Documents\Programação\Vêneto\veneto-agentes\registro\connect.md`
- ADR-0001 no vault registra a adoção.

## Particularidades

- **App aninhado:** a raiz do git é `ConnectVeneto/`, mas o app está em
  `Downloads/ConnectVeneto/ConnectVeneto/`. Comandos `npm`/`npx` rodam de lá.
- **Remote fora do padrão:** `github.com/3Ainvestimentos/ConnectVeneto` (não `venetomfo/*`).
- **Firebase:** as mudanças no projeto Firebase (rules, índices, `hubModules`, `systemSettings`)
  são aplicadas pelo agente via service account, com aprovação. Os operadores não têm acesso ao
  console.
- **Azure depois:** o banco oficial é o Azure SQL (db-guardian), mas o Connect roda fora da
  Azure e não alcança o firewall do SQL. Decisão de 2026-10-15: dados novos (Hub de Comunicação)
  ficam no Firestore, atrás de uma camada de repositório, e migram junto com o Connect.
- **Super admin em duas listas:** `admin_config` (front) e `config` (rules e `auth.ts`). Grave
  nas duas.
