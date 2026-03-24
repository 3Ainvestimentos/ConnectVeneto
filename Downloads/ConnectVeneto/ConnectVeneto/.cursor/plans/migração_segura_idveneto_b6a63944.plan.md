---
name: Migração segura idVeneto
overview: Executar migração id3a -> idVeneto em duas fases com compatibilidade temporária, validações e rollback rápido para minimizar risco de quebra.
todos:
  - id: fase1-modelo
    content: Adicionar idVeneto e manter id3a temporário com fallback de leitura.
    status: pending
  - id: fase1-dados
    content: Garantir idVeneto único para todos colaboradores e consistência de referências.
    status: pending
  - id: fase1-validacao
    content: Validar login, permissões, filtros e fluxos críticos com fallback ativo.
    status: pending
  - id: fase1-identidade-veneto
    content: Atualizar identidade de usuários para Veneto (domínio, placeholders, textos e validações na tela de Sistema).
    status: pending
  - id: fase1-checklist-ui-auth
    content: Executar checklist de substituição completa de referências 3A/3ariva no fluxo de login e cadastro de usuários.
    status: pending
  - id: fase2-corte
    content: Remover fallback e tornar idVeneto obrigatório no código.
    status: pending
  - id: fase2-limpeza
    content: Remover dependências e resíduos de id3a após homologação.
    status: pending
isProject: false
---

# Migração segura `id3a` -> `idVeneto`

## Objetivo

Garantir migração sem regressão funcional, mantendo o sistema estável durante a transição.

## Estratégia (2 fases)

### Fase 1 — Compatibilidade (sem corte)

- Adicionar `idVeneto` no modelo de colaborador e manter `id3a` temporariamente.
- Leitura com fallback: usar `idVeneto ?? id3a` em todos os pontos críticos.
- Escrita dupla nos fluxos críticos (quando necessário): preencher `idVeneto` e manter `id3a` durante a janela de migração.
- Atualizar UI/admin para exibir e editar `idVeneto` como principal.
- Rodar script/checklist de dados para garantir que todo colaborador tenha `idVeneto` único.
- Padronizar identidade de usuários para Veneto:
  - remover referências visuais/textuais de 3A na criação/edição de usuário;
  - atualizar placeholders (ex.: e-mail `usuario@venetomfo.com.br`);
  - validar fluxo de autenticação e domínio corporativo Veneto;
  - bloquear autenticação com domínios fora de `@venetomfo.com.br`, incluindo `@3ariva`.
- Aplicar substituição completa de `3ariva` -> `Veneto` no fluxo ponta a ponta (login + cadastro), incluindo labels, placeholders, mensagens e ajuda contextual.

### Fase 2 — Corte controlado

- Validar que não há mais docs dependentes de `id3a` (queries e referências).
- Remover fallback do código (`idVeneto` passa a ser obrigatório).
- Remover `id3a` de formulários/exports/imports e contratos internos.
- Homologar e só então limpar `id3a` dos dados remanescentes.

## Pontos críticos a cobrir

- Auth e associação de colaborador no login.
- Permissões/allowedUserIds e filtros por usuário.
- Logs de auditoria que gravam `userId`.
- Seleção de destinatários, recipients, actions e assignees.
- Módulos administrativos e telas de dashboard/documentos/solicitações.
- Tela de Sistema / Gestão de usuários com textos, labels e placeholders já no padrão Veneto.
- Tela de Login com identidade Veneto (incluindo mensagens de erro/sucesso e textos de apoio sem referência a 3A/3ariva).
- Política de autenticação: aceitar somente e-mails `@venetomfo.com.br` no login.
- Substituição de branding no layout principal com mapeamento aprovado de logos (desktop + mobile).

## Arquivos prioritários

- [src/contexts/CollaboratorsContext.tsx](src/contexts/CollaboratorsContext.tsx)
- [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- [src/components/admin/ManageCollaborators.tsx](src/components/admin/ManageCollaborators.tsx)
- [src/components/admin/ManageCollaborators.tsx](src/components/admin/ManageCollaborators.tsx) (labels/placeholders de cadastro)
- [src/app/login/page.tsx](src/app/login/page.tsx)
- [src/components/layout/Header.tsx](src/components/layout/Header.tsx)
- [src/components/layout/AppLayout.tsx](src/components/layout/AppLayout.tsx)
- [src/app/(app)/dashboard/page.tsx](src/app/%28app%29/dashboard/page.tsx)
- [src/components/documents/DocumentRepositoryClient.tsx](src/components/documents/DocumentRepositoryClient.tsx)
- [src/app/(app)/applications/page.tsx](src/app/%28app%29/applications/page.tsx)

## Mapeamento de logos aprovado

- Header desktop (fundo escuro): `docs/PNG/logotipo_vênetoPrancheta 3.png` (logo branca completa).
- Sidebar em fundo claro: `docs/PNG/logotipo_vênetoPrancheta 1.png` (logo azul marinho completa).
- Header mobile: ícone isolado (sem wordmark), preferencialmente `docs/PNG/logotipo_vênetoPrancheta 9.png`.
- Estratégia de publicação: copiar assets aprovados para `public/veneto/` e referenciar por caminhos estáveis.

## Checklist obrigatório de substituição (`3ariva` -> `Veneto`)

- Login
  - placeholders, labels e helper-texts em padrão Veneto;
  - mensagens de erro/sucesso sem menções a 3A/3ariva;
  - validação obrigatória de domínio corporativo Veneto (`@venetomfo.com.br`);
  - bloqueio explícito de e-mails `@3ariva` e demais domínios não permitidos.
- Sistema > Cadastro/Edição de usuários
  - placeholders de e-mail em domínio Veneto;
  - campo principal de identificação em `idVeneto`;
  - remoção de qualquer rótulo/texto legado com `id3a`/3A/3ariva.
- Branding visual (logo)
  - header desktop usando `Prancheta 3`;
  - sidebar clara usando `Prancheta 1`;
  - mobile usando ícone isolado;
  - ausência de logos 3A nas áreas alteradas.
- Fluxo de permissão e associação
  - vinculação de `authUid` no primeiro login de colaborador Veneto;
  - filtros e permissões funcionando por `idVeneto`.
- Regressão funcional
  - criação, edição, listagem e busca de usuários sem quebra;
  - fallback `idVeneto ?? id3a` ativo durante a Fase 1.

## Rollback

- Manter fallback `idVeneto ?? id3a` ativo até homologação final.
- Se ocorrer regressão, voltar temporariamente para `id3a` sem alterar dados.

## Critérios de aceite

- Login e associação `authUid` funcionando com usuário Veneto.
- Login bloqueando corretamente e-mails fora de `@venetomfo.com.br` (incluindo `@3ariva`).
- Todas as permissões e filtros funcionando com `idVeneto`.
- Nenhuma referência obrigatória restante a `id3a` na Fase 2.
- Tela de criação/edição de usuário sem referência a 3A e com placeholders do domínio Veneto.
- Tela de login sem referências a 3A/3ariva e com identidade textual Veneto.
- Busca textual no código sem ocorrências funcionais legadas de `3ariva` em UI/UX do fluxo de autenticação e cadastro.
- Header, sidebar e versão mobile exibindo os logos aprovados com contraste adequado.
- Lint, typecheck e build sem erros.
- `createdAt` segue automático em ISO string no cliente (como definido).

