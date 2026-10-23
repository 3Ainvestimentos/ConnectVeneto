/**
 * Perfis de acesso (ADR 0005). Regras puras, usadas no servidor (que grava o acesso efetivo em
 * `permissions`/`modulePermissions`) e na tela (que mostra de onde veio cada item).
 */
import type { CollaboratorPermissions } from '@/contexts/CollaboratorsContext';
import { unitChain, type OrgUnit } from '@/lib/hub/org-units';
import { PERMISSION_KEYS, type PermissionKey } from './catalog';

export const ACCESS_PROFILES_COLLECTION = 'accessProfiles';

/** Pacote de acesso. Módulo ausente = sem registro (vale o padrão do módulo); `[]` = sem acesso. */
export interface AccessProfile {
  id: string;
  name: string;
  description?: string;
  permissions: PermissionKey[];
  modules: Record<string, string[]>;
}

/**
 * Ajustes da pessoa sobre o perfil. Permissão: true/false força. Módulo: lista exata (`[]` = sem
 * acesso) ou `null` = sem registro (padrão do módulo).
 */
export interface AccessOverrides {
  permissions?: Partial<Record<PermissionKey, boolean>>;
  modules?: Record<string, string[] | null>;
}

export interface EffectiveAccess {
  permissions: CollaboratorPermissions;
  modulePermissions: Record<string, string[]>;
}

export interface ProfileSource {
  profileId: string | null;
  /** De onde veio: perfil próprio da pessoa, de uma unidade (e qual) ou nenhum. */
  from: 'pessoa' | 'unidade' | null;
  unitId?: string;
}

/** Perfil que vale para a pessoa: o próprio; senão o da unidade mais próxima (subindo) que tiver um. */
export function resolveProfile(
  person: { accessProfileId?: string | null; unitId?: string | null },
  units: Map<string, OrgUnit & { accessProfileId?: string | null }>,
  profileIds: Set<string>,
): ProfileSource {
  if (person.accessProfileId && profileIds.has(person.accessProfileId)) return { profileId: person.accessProfileId, from: 'pessoa' };
  for (const u of unitChain(units, person.unitId) as (OrgUnit & { accessProfileId?: string | null })[]) {
    if (u.accessProfileId && profileIds.has(u.accessProfileId)) return { profileId: u.accessProfileId, from: 'unidade', unitId: u.id };
  }
  return { profileId: null, from: null };
}

const sortList = (l: string[]) => [...new Set(l)].sort();

/** Acesso efetivo: tudo desligado, liga o que o perfil traz e aplica os ajustes. */
export function effectiveAccess(profile: Pick<AccessProfile, 'permissions' | 'modules'>, overrides: AccessOverrides = {}): EffectiveAccess {
  const granted = new Set(profile.permissions);
  const permissions = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, overrides.permissions?.[k] ?? granted.has(k)])) as unknown as CollaboratorPermissions;
  const modulePermissions: Record<string, string[]> = {};
  for (const [id, list] of Object.entries(profile.modules)) modulePermissions[id] = sortList(list);
  for (const [id, list] of Object.entries(overrides.modules ?? {})) {
    if (list === null) delete modulePermissions[id];
    else modulePermissions[id] = sortList(list);
  }
  return { permissions, modulePermissions };
}

/**
 * Ajustes que fazem o perfil reproduzir exatamente o acesso atual (migração sem mudar nada).
 * Considera só as chaves do catálogo; módulo ausente no atual e presente no perfil vira `null`.
 */
export function overridesToMatch(
  profile: Pick<AccessProfile, 'permissions' | 'modules'>,
  current: { permissions?: Partial<CollaboratorPermissions>; modulePermissions?: Record<string, string[]> },
  defaults: CollaboratorPermissions,
): AccessOverrides {
  const base = effectiveAccess(profile);
  const out: AccessOverrides = {};
  for (const k of PERMISSION_KEYS) {
    const now = current.permissions?.[k] ?? defaults[k];
    if (now !== base.permissions[k]) (out.permissions ??= {})[k] = now;
  }
  const ids = new Set([...Object.keys(base.modulePermissions), ...Object.keys(current.modulePermissions ?? {})]);
  for (const id of ids) {
    const want = current.modulePermissions?.[id];
    const have = base.modulePermissions[id];
    const same = want === undefined ? have === undefined : have !== undefined && sortList(want).join('|') === have.join('|');
    if (!same) (out.modules ??= {})[id] = want === undefined ? null : sortList(want);
  }
  return out;
}

/** Quantos itens a pessoa tem fora do perfil. */
export function countOverrides(o: AccessOverrides | undefined): number {
  return Object.keys(o?.permissions ?? {}).length + Object.keys(o?.modules ?? {}).length;
}

/** Mesmo acesso? (para gravar só o que mudou). */
export function sameAccess(a: EffectiveAccess, b: { permissions?: Partial<CollaboratorPermissions>; modulePermissions?: Record<string, string[]> }, defaults: CollaboratorPermissions): boolean {
  if (PERMISSION_KEYS.some((k) => a.permissions[k] !== (b.permissions?.[k] ?? defaults[k]))) return false;
  const bm = b.modulePermissions ?? {};
  const ids = new Set([...Object.keys(a.modulePermissions), ...Object.keys(bm)]);
  for (const id of ids) {
    const x = a.modulePermissions[id];
    const y = bm[id];
    if ((x === undefined) !== (y === undefined)) return false;
    if (x && y && x.join('|') !== sortList(y).join('|')) return false;
  }
  return true;
}
