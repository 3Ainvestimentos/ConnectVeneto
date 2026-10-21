/**
 * Estrutura organizacional (ADR 0004): unidades em árvore Diretoria › Área › Equipe, cada uma com
 * um responsável. A pessoa pertence a uma unidade e, por padrão, reporta ao responsável dela; o
 * responsável reporta ao da unidade-mãe. Exceção manual na pessoa (`managerOverrideIdVeneto`).
 * Funções puras, usadas no servidor e no navegador.
 */

export const UNIT_TYPES = ['diretoria', 'area', 'equipe'] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const UNIT_TYPE_LABEL: Record<UnitType, string> = { diretoria: 'Diretoria', area: 'Área', equipe: 'Equipe' };

export interface OrgUnit {
  id: string;
  name: string;
  type: UnitType;
  parentId: string | null;
  /** `idVeneto` do responsável pela unidade. */
  leaderIdVeneto: string | null;
}

/** Quem pode ser mãe de quem: Diretoria no topo, Área sob Diretoria (ou no topo), Equipe sob Área ou Diretoria. */
export function canBeChildOf(child: UnitType, parent: UnitType | null): boolean {
  if (parent === null) return child !== 'equipe';
  return UNIT_TYPES.indexOf(parent) < UNIT_TYPES.indexOf(child);
}

/** Cadeia da unidade até o topo: [unidade, mãe, avó…]. Para em ciclos. */
export function unitChain(units: Map<string, OrgUnit>, unitId: string | null | undefined): OrgUnit[] {
  const chain: OrgUnit[] = [];
  const seen = new Set<string>();
  let current = unitId ? units.get(unitId) : undefined;
  while (current && !seen.has(current.id)) {
    chain.push(current);
    seen.add(current.id);
    current = current.parentId ? units.get(current.parentId) : undefined;
  }
  return chain;
}

/** A unidade `ancestorId` está acima de (ou é) `unitId`? Usado para impedir ciclos ao mover. */
export function isSameOrDescendant(units: Map<string, OrgUnit>, unitId: string, ancestorId: string): boolean {
  return unitChain(units, unitId).some((u) => u.id === ancestorId);
}

/**
 * Gestor pela estrutura: o primeiro responsável, subindo a partir da unidade da pessoa, que não seja
 * ela mesma. `null` se nenhuma unidade da cadeia tiver responsável.
 */
export function managerFromStructure(units: Map<string, OrgUnit>, unitId: string | null | undefined, personIdVeneto: string): string | null {
  for (const u of unitChain(units, unitId)) {
    if (u.leaderIdVeneto && u.leaderIdVeneto !== personIdVeneto) return u.leaderIdVeneto;
  }
  return null;
}

/** Filhas diretas de uma unidade (ou as do topo, com `null`), por tipo e nome. */
export function childUnits(units: OrgUnit[], parentId: string | null): OrgUnit[] {
  return units
    .filter((u) => u.parentId === parentId)
    .sort((a, b) => UNIT_TYPES.indexOf(a.type) - UNIT_TYPES.indexOf(b.type) || a.name.localeCompare(b.name, 'pt-BR'));
}

/** Rótulo do caminho: "Diretoria X › Área B › Equipe A" (do topo para a unidade). */
export function unitPathLabel(units: Map<string, OrgUnit>, unitId: string | null | undefined): string {
  return unitChain(units, unitId)
    .reverse()
    .map((u) => u.name)
    .join(' › ');
}
