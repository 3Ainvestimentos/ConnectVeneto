/**
 * Campos legados derivados da estrutura (ADR 0004). O RH não digita mais Área, Equipe e Líder: quem
 * está numa unidade tem esses valores calculados do organograma, para as telas que ainda os leem
 * (Público por área/equipe da Consulta, seleção de destinatários, aprovadores de férias…).
 *
 * - `area`: nome da unidade do tipo Área mais próxima na cadeia; sem Área, a Diretoria mais próxima;
 *   sem nenhuma das duas, fica como está.
 * - `team`: nome da Equipe da cadeia, ou '' se a pessoa não está numa Equipe.
 * - `leader`: nome do gestor resolvido por `buildPeople`; sem gestor, fica como está.
 *
 * Só para quem tem `unitId` válido. Função pura (o servidor grava; o script faz a simulação).
 */
import { unitChain, type OrgUnit } from './org-units';
import { buildPeople, type CollaboratorLike } from './people';

export const ORG_DERIVED_FIELDS = ['area', 'team', 'leader'] as const;
export type OrgDerivedField = (typeof ORG_DERIVED_FIELDS)[number];

export interface OrgDerivedChange {
  field: OrgDerivedField;
  oldValue: string | null;
  newValue: string;
}

export interface OrgDerivedUpdate {
  id: string;
  name: string;
  changes: OrgDerivedChange[];
}

/** Valores que a estrutura define para cada pessoa com unidade (campo ausente = não mexe). */
export function deriveOrgFields(collaborators: CollaboratorLike[], units: OrgUnit[]): Map<string, Partial<Record<OrgDerivedField, string>>> {
  const byId = new Map(units.map((u) => [u.id, u]));
  const people = new Map(buildPeople(collaborators, units).map((p) => [p.id, p]));
  const names = new Map(collaborators.map((c) => [c.id, c.name]));
  const out = new Map<string, Partial<Record<OrgDerivedField, string>>>();

  for (const c of collaborators) {
    if (!c.unitId || !byId.has(c.unitId)) continue;
    const chain = unitChain(byId, c.unitId);
    const values: Partial<Record<OrgDerivedField, string>> = {};
    const area = chain.find((u) => u.type === 'area') ?? chain.find((u) => u.type === 'diretoria');
    if (area) values.area = area.name;
    values.team = chain.find((u) => u.type === 'equipe')?.name ?? '';
    const managerId = people.get(c.id)?.managerId;
    const managerName = managerId ? names.get(managerId) : undefined;
    if (managerName) values.leader = managerName;
    out.set(c.id, values);
  }
  return out;
}

/** O que mudaria no cadastro: só os campos diferentes do que está gravado. `only` limita por id. */
export function computeOrgDerivedUpdates(
  collaborators: CollaboratorLike[],
  units: OrgUnit[],
  only?: string[],
): OrgDerivedUpdate[] {
  const derived = deriveOrgFields(collaborators, units);
  const filter = only ? new Set(only) : null;
  const updates: OrgDerivedUpdate[] = [];
  for (const c of collaborators) {
    if (filter && !filter.has(c.id)) continue;
    const values = derived.get(c.id);
    if (!values) continue;
    const changes = ORG_DERIVED_FIELDS.flatMap((field): OrgDerivedChange[] => {
      const newValue = values[field];
      if (newValue === undefined || (c[field] ?? '') === newValue) return [];
      return [{ field, oldValue: c[field] ?? null, newValue }];
    });
    if (changes.length) updates.push({ id: c.id, name: c.name, changes });
  }
  return updates;
}
