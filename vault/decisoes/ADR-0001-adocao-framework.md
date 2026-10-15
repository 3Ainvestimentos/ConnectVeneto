---
tipo: adr
atualizado: 2026-10-15
tags: [adr, framework, tier]
---

# ADR-0001 — Adoção do framework veneto-agentes (tier médio)

**Status**: aceito (2026-10-15) · **Decidido por**: Victor Santos

## Contexto

Vários domínios dependem do Connect (cadastro de módulo e permissões, `HUB_JWT_SECRET`, Sandbox,
Central de Notificações), e o db-guardian registrou em 2026-10-15 que esses pedidos só tinham canal
humano: "dono do ConnectVeneto, sem domínio no registro". O trabalho do Hub de Comunicação Interna
também vai precisar conversar com outros domínios.

## Decisão

Adotar o framework como domínio `connect`, **tier médio**: produto web usado pela empresa toda.
Código é livre. Deploy, `firestore.rules`/`storage.rules`, índices, dados de produção no Firestore
(`hubModules`, `systemSettings`, `collaborators`), segredos e infra precisam de aprovação.

## Consequências

- Outros domínios passam a abrir pedidos para `connect` (tipos na página do registro).
- O kit fica na raiz do git; o app continua em `Downloads/ConnectVeneto/ConnectVeneto/`.
- O remote é `github.com/3Ainvestimentos/ConnectVeneto`, fora do padrão `venetomfo/*`. A exceção
  está registrada na página do registro.
