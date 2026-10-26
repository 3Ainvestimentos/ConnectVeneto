---
tipo: pedido
solicitante: projeto-base-dados-cadastrais
autor: Victor Santos
alvo: connect
data: 2026-10-21
tipo-pedido: modulo-connect
prioridade: normal
status: concluido
---

# Pedido — cadastrar o módulo `cadastro` (interface da base cadastral) no hub + entregar o HUB_JWT_SECRET

## Contexto

O domínio **projeto-base-dados-cadastrais** construiu a interface de cadastro de clientes (Next.js 16,
mesmo padrão do TrackFlow), que substitui a digitação direta nos quadros do Monday. O web app já
existe (criado pela segurança em 2026-10-19): `vnt-interface-cadastro`, plano `asp-vneto-b3`.

O primeiro teste de ponta a ponta será feito **só pela Letycia (cadastro)**, num ambiente de
homologação: os ajustes feitos na interface precisam aparecer nas cópias dos quadros do Monday.
Para isso o módulo precisa abrir dentro do Connect.

Do lado do módulo, o protocolo v1.5 já está implementado:
- `/embed` com `lib/hub-auth.ts` canônico (H-01 e H-03: reenvio a cada 1,5 s, tolera token duplicado);
- verificação do Module Token no servidor (`/api/hub-verify`, `iss=connect-veneto`, `aud=cadastro`);
- **padrão B** (§6.3): troca por cookie de sessão local em `/api/hub-session` (SameSite=None, Secure,
  Partitioned);
- `CV_MODULE_READY` no layout das páginas de conteúdo (H-06);
- CSP `frame-ancestors 'self' https://connect.venetomfo.com.br`.

O módulo cria o usuário interno no primeiro login (pelo e-mail do token) **sem nenhum papel**: o que a
pessoa vê e faz lá dentro é decidido por papéis cadastrados no próprio módulo (tela Acessos). Por isso
o catálogo de permissões do hub fica mínimo.

## O que precisa

**1. Cadastro em `hubModules`** (Admin → Módulos):

| Campo | Valor |
|---|---|
| `id` | `cadastro` |
| `label` | Cadastro de clientes |
| `description` | Base cadastral de clientes: cadastro, alterações e revisão |
| `iconName` | `ClipboardList` |
| `slug` | `cadastro` |
| `url` | `https://vnt-interface-cadastro.azurewebsites.net` (origem; confirmem o host com `az webapp show` se o default hostname tiver sufixo regional) |
| `embedPath` | `/embed` |
| `accessMode` | `explicit` |
| `permissionCatalog` | `cadastro:view` (Acessar) · `cadastro:manage` (Administrar acessos do módulo) |
| `adminPermissions` | `cadastro:view`, `cadastro:manage` |
| `layout` | `fullscreen` |
| `skeletonTheme` | `light` |
| `enabled` / `showInNav` | `true` / `true` |

**2. Acesso** (nível 1): `cadastro:view` para **Letycia** (cadastro) e **Victor Santos**
(victor.santos@venetomfo.com.br), mais `cadastro:manage` para o Victor.

**3. `HUB_JWT_SECRET`** (tipo `segredo-hub`): entregar ao Victor por Bitwarden. Ele mesmo grava nas
App Settings do web app; o segredo nunca passa por chat, repositório nem vault.

## Critérios de aceite

- `/cadastro` aparece no menu para a Letycia e o Victor e abre o iframe do módulo.
- O hub emite o Module Token com `aud=cadastro` e `permissions` contendo `cadastro:view`.
- O módulo recebe `CV_MODULE_READY` em menos de 8 s (sem cair no H-07).
- Avisem na resposta o `url` final cadastrado (o módulo usa a mesma origem no `NEXT_PUBLIC_HUB_ORIGIN`
  do lado dele só para o Connect; não precisa mudar nada no hub além do cadastro).

## Resposta do dono

2026-10-22 — **Concluído (item 1, com o id atualizado).** O domínio renomeou o módulo para
`hub-cadastro` ("Hub de Cadastro"); o código do módulo usa `aud=hub-cadastro`.

- Gravado `hubModules/hub-cadastro` via `scripts/add-hub-cadastro-module.mjs --apply` (Admin SDK):
  embedded, `/hub-cadastro`, url `https://vnt-interface-cadastro.azurewebsites.net`, `/embed`,
  `explicit`, ícone `ClipboardList`, ordem 12, fullscreen/light. Catálogo: `hub-cadastro:manage`
  (Admin Módulo); admin: `hub-cadastro:view` + `hub-cadastro:manage`.
- **Acessos (item 2) não concedidos**: ficam em Admin → Módulos/Permissões ou
  `--apply --acessos` (Victor). A Letycia não existe na coleção `collaborators`: precisa ser
  cadastrada antes.
- Item 3 (`HUB_JWT_SECRET`): já está no `.env.local` do módulo (hot.md do domínio).
- Rollback: apagar o doc `hubModules/hub-cadastro` (ou `enabled: false` em Admin → Módulos).
