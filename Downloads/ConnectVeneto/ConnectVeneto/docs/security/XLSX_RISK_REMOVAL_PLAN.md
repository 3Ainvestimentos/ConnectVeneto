# Plano para remover `xlsx` (SheetJS) do risco high

## Contexto

A dependencia `xlsx` (versao community) possui 2 advisories high **sem fix upstream**:

- [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) - Prototype Pollution
- [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) - ReDoS

Uso atual no projeto:

- `src/components/admin/ManageCollaborators.tsx` - import CSV/XLSX de colaboradores.
- `src/components/admin/ManageTripsBirthdays.tsx` - import de aniversariantes.

Ambos ja receberam **mitigacao local** no Bloco 3:

- limite de 5 MB por arquivo
- limite de 5 000 linhas por import (colaboradores)
- rejeicao explicita de planilha sem aba valida
- mensagem clara de erro para admin

Isto reduz dramaticamente o risco real de DoS/PP, mas **nao remove o advisory do audit**.

## Opcoes para remover o advisory

### Opcao A - Migrar para `exceljs` (recomendado)

- `exceljs` e ativamente mantido, tem tipagens TS, nao tem advisories high abertos.
- API `workbook.xlsx.load(buffer)` substitui `XLSX.read(buffer)`.
- `worksheet.eachRow(row => ...)` substitui `sheet_to_json`.
- Mantem UX: admin continua enviando XLSX.

Esforco estimado:

- 1 arquivo utilitario `src/lib/xlsx-import.ts` encapsulando leitura + validacao.
- Atualizar `parseXlsxFile` em `ManageCollaborators.tsx` e `parseSpreadsheet` em `ManageTripsBirthdays.tsx`.
- Atualizar testes.
- Remover `xlsx` do `package.json`.

Risco: baixo. `exceljs` tem comportamento equivalente para leitura.

### Opcao B - Forcar CSV-only

- Remover completamente o suporte a XLSX.
- Admin passa a exportar em CSV (ja existe modelo CSV).
- Reduz superficie e dependencia.

Esforco: baixo (remover `parseXlsxFile` e `parseSpreadsheet` XLSX).

Risco UX: admin precisa salvar como CSV no Excel antes de subir.

### Opcao C - Manter atual

- Mitigacao local ja feita cobre o risco real.
- Advisory permanece no `npm audit` como risco residual aceito e documentado.

Risco operacional: advisories aparecem em todo audit futuro.

## Recomendacao tecnica

**Opcao A** seria o melhor equilibrio entre esforco, UX e reducao real de risco.

## Decisao tomada

**Opcao C aceita formalmente.**

- A dependencia `xlsx` permanece no projeto.
- O advisory continuara aparecendo em `npm audit` como risco residual conhecido.
- O risco real de DoS/Prototype Pollution esta mitigado pelas constantes e validacoes
  aplicadas no Bloco 3 (`COLLABORATORS_IMPORT_MAX_BYTES`, `COLLABORATORS_IMPORT_MAX_ROWS`,
  rejeicao de aba invalida, mensagens claras de erro).
- Qualquer novo advisory high/critical que aparecer para `xlsx` deve reabrir esta decisao.

## Gatilhos para reavaliacao

Reabrir este documento e executar Opcao A ou B se:

- Surgir advisory critical novo para `xlsx`.
- Surgir relato de exploracao em ambiente parecido.
- A necessidade de importacao em massa crescer (ex.: planilhas maiores que 5000 linhas).
- Politica interna ou auditoria externa exigir zero high em `npm audit`.

## Criterio de aceite (quando a Opcao A for executada no futuro)

- [ ] `npm audit` nao lista mais `xlsx` como high.
- [ ] `ManageCollaborators` e `ManageTripsBirthdays` passam nos testes existentes.
- [ ] Limites (`COLLABORATORS_IMPORT_MAX_BYTES`, `COLLABORATORS_IMPORT_MAX_ROWS`) continuam ativos.
- [ ] `xlsx` removido de `package.json` e `package-lock.json`.
- [ ] `docs/security/NPM_AUDIT_SNAPSHOT.md` atualizado com o novo estado.
