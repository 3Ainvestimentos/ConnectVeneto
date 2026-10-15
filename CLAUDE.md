# connect — ConnectVeneto, a intranet da Vêneto e o hub dos módulos internos

<!-- Gerado por /bootstrap-repo em 2026-10-15. -->

Este repo é o domínio **connect** do framework de agentes da Vêneto
(hub: `C:\Users\victor.santos\Documents\Programação\Vêneto\veneto-agentes`). Idioma: **pt-BR**.
Documento fundador: [context.md](context.md).

## O que é este repo

O **ConnectVeneto** é a intranet de todos os colaboradores da Vêneto: Home, Notícias, Documentos,
Solicitações, Consulta Pessoal, Regras Comerciais, e o **hub** onde os módulos internos
(TrackFlow, Dados Estratégicos, Portal do Cliente, Atividade Comercial e outros) entram embarcados.

- **Onde está o app:** a raiz do git é esta pasta, mas o app Next.js mora em
  `Downloads/ConnectVeneto/ConnectVeneto/` (rode `npm`/`npx` de lá).
- **Stack:** Next.js 15 (App Router), React 18, Tailwind + shadcn/ui, TanStack Query, zod.
  Firebase: Auth (Google), Firestore, Storage, Admin SDK nas API routes.
- **Hospedagem:** fora da Azure (Vercel / Firebase App Hosting). A infra oficial da Vêneto é a
  Azure, e a migração do Connect está prevista, mas ainda não começou. Até lá, dados novos ficam no
  Firestore, atrás de uma camada de repositório para a troca custar pouco.
- **Hub de módulos:** o menu e os módulos vêm da coleção `hubModules`. Os módulos se autenticam por
  JWT de hub (`HUB_JWT_SECRET`), conforme `CONNECTVENETO_MODULE_PROTOCOL.md`. Há também a Central
  de Notificações (`/api/hub/notifications`).
- **Permissões:** flags em `collaborators.permissions` e `modulePermissions`. As rules do Firestore
  não leem essas flags, então toda escrita privilegiada passa por API route com Admin SDK.
- **Glossário:** `Downloads/ConnectVeneto/ConnectVeneto/CONTEXT.md`. Decisões de arquitetura do app:
  `Downloads/ConnectVeneto/ConnectVeneto/docs/adr/`.

## Tier de criticidade: médio

Produto web usado por toda a empresa. **Código livre** (editar, testar, build, commit, push de
branch). **O que sai da máquina é aprovado:** deploy, mudança de `firestore.rules`/`storage.rules`,
índices, dados de produção no Firestore (incluindo `systemSettings`, `hubModules` e
`collaborators`), segredos e infra.

Regras transversais (todos os tiers):
- **NUNCA** ler `.env`/segredos (deny no settings.json) nem exibir credenciais em qualquer
  saída, changelog ou nota do vault. Senhas em registros: sempre `'***'`.
- **DDL, usuários e permissões de banco são domínio do db-guardian** — sempre via `/pedir
  db-guardian`, nunca direto, mesmo em rotina autônoma.
- Toda escrita relevante aplicada → entrada no `vault/changelog/AAAA-MM.md` antes de encerrar.
- Commit + push automáticos após mudanças (histórico git = parte do second-brain).

## Protocolo de memória

- **Início de sessão**: leia `vault/hot.md` (contexto recente; ~10 bullets) e, se precisar,
  `vault/index.md`. Se o hot.md citar pedido enviado em aberto, cheque o status no arquivo do
  pedido (no repo alvo, ou em `vault/pedidos/enviados/` se foi via outbox) e atualize o bullet.
  Se houver demandas abertas, rode `/demandas`.
- **Fim de sessão significativa**: destile a conversa no vault (`/salvar-sessao`): decisões →
  `vault/decisoes/` (ADR) quando forem de arquitetura; pendências → nota da sessão + `hot.md`;
  sinais de gestão (padrões de trabalho, lacunas aparentes, retrabalho por instrução ambígua) →
  perfil do operador em `vault/pessoas/<autor>.md`, sempre com evidência — o arquivo é visível
  à própria pessoa. Um hook de Stop cobra isso automaticamente.
- **Nunca** copie credenciais nem transcripts brutos para o vault — só conhecimento destilado.

## Como falar com outros domínios

Registro de domínios: `C:\Users\victor.santos\Documents\Programação\Vêneto\veneto-agentes\registro\_indice.md`

1. **LER** (sempre, grátis): resolva o caminho do domínio no registro e leia o vault dele
   (`hot.md` → `index.md` → páginas). Nunca edite nada fora deste repo.
2. **CONSULTAR** (opinião/julgamento): `/consultar <dominio> "<pergunta>"` — invoca o agente
   especialista em modo somente-leitura.
3. **PEDIR** (escrita no domínio alheio): `/pedir <dominio>` — abre pedido estruturado na inbox
   do dono; ele executa sob os guardrails dele. Escrita cross-domínio direta é proibida.
   Se o repo do alvo não existir nesta máquina (o caso de quem trabalha fora da máquina do
   gestor), o pedido é gravado na **outbox deste repo** (`vault/pedidos/enviados/`) e viaja no seu
   push: o hub entrega ao dono e traz a resposta de volta para o mesmo arquivo, que você lê no
   próximo `git pull`. LER e CONSULTAR, esses sim, precisam dos repos no filesystem local.

## Pedidos (inbox e outbox deste domínio)

Sua inbox é `vault/pedidos/`. Outros agentes depositam pedidos ali. Processe com
`/processar-pedidos` — cada pedido executa sob os guardrails DESTE tier, atualiza o status no
próprio arquivo e gera changelog.

Sua outbox é `vault/pedidos/enviados/` — pedidos que **você** abriu para domínios cujo repo não
existe nesta máquina. Duas regras: o arquivo tem **escritor único** (depois do push você nunca
mais o edita; mudou de ideia, abra outro pedido), e `entregue-em:` no frontmatter é o recibo de
que o hub já entregou ao dono. O status e a "Resposta do dono" chegam ali por espelhamento —
`/pedidos` mostra o painel.

## Demandas delegadas (`vault/demandas/`)

Demanda é trabalho que o gestor delegou a uma **pessoa** deste domínio — um milestone, não uma
tarefa: a spec diz o resultado esperado, o "como" é de quem executa.

- `vault/demandas/` é a **segunda escrita externa sancionada** (junto com `vault/pedidos/`): o
  gestor grava ali a spec, num commit com apenas esse arquivo.
- **Fila e status ficam no TrackFlow; contexto e requisitos ficam na spec.** `status` e
  `prioridade` no frontmatter são espelhos — em divergência o TrackFlow vence, e `/demandas`
  corrige o arquivo. Já `revisao` e o relatório de revisão pertencem ao arquivo.
- Ciclo: `/demandas` (ver o que há) → `/trabalhar-demanda` (branch `demanda/<slug>`) →
  `/revisar-demanda` (gestor). **Quem executa nunca conclui o item** — a conclusão é da revisão
  aprovada.
- Sem o MCP do TrackFlow, tudo funciona só em arquivo + git: fica a pendência
  `sincronizar TrackFlow: <slug>` no `hot.md` e a próxima sessão com MCP reconcilia.
- O token do TrackFlow é **segredo**: `claude mcp add --scope local` na sua máquina, nunca
  `--scope project`, nunca commitado, nunca no vault.
