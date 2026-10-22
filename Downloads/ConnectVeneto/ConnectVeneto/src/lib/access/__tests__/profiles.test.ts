import { DEFAULT_PERMISSIONS } from '@/lib/access/catalog';
import { effectiveAccess, overridesToMatch, resolveProfile, sameAccess } from '@/lib/access/profiles';
import type { OrgUnit } from '@/lib/hub/org-units';

const unit = (id: string, parentId: string | null, accessProfileId: string | null = null): OrgUnit & { accessProfileId: string | null } => ({
  id,
  name: id,
  type: parentId ? 'equipe' : 'area',
  parentId,
  leaderIdVeneto: null,
  accessProfileId,
});

describe('access/profiles', () => {
  const units = new Map([
    ['dir', { ...unit('dir', null, 'colaborador'), type: 'diretoria' as const }],
    ['com', unit('com', 'dir', 'comercial')],
    ['bh', unit('bh', 'com')],
    ['rh', unit('rh', 'dir')],
  ]);
  const ids = new Set(['colaborador', 'comercial', 'rh-perfil']);

  it('perfil: o próprio da pessoa; senão o da unidade mais próxima que tiver um', () => {
    expect(resolveProfile({ unitId: 'bh' }, units, ids)).toEqual({ profileId: 'comercial', from: 'unidade', unitId: 'com' });
    expect(resolveProfile({ unitId: 'rh' }, units, ids)).toEqual({ profileId: 'colaborador', from: 'unidade', unitId: 'dir' });
    expect(resolveProfile({ unitId: 'bh', accessProfileId: 'rh-perfil' }, units, ids)).toEqual({ profileId: 'rh-perfil', from: 'pessoa' });
    expect(resolveProfile({ unitId: 'bh', accessProfileId: 'apagado' }, units, ids).profileId).toBe('comercial');
    expect(resolveProfile({}, units, ids)).toEqual({ profileId: null, from: null });
  });

  it('acesso efetivo: perfil liga, ajuste força; módulo null volta ao padrão do módulo', () => {
    const profile = { permissions: ['canViewDocuments' as const, 'canManageContent' as const], modules: { trackflow: ['trackflow:view'], 'portal-cliente': [] } };
    const eff = effectiveAccess(profile, { permissions: { canManageContent: false, canViewAudit: true }, modules: { 'portal-cliente': null, inicio: ['inicio:view'] } });
    expect(eff.permissions.canViewDocuments).toBe(true);
    expect(eff.permissions.canManageContent).toBe(false);
    expect(eff.permissions.canViewAudit).toBe(true);
    expect(eff.permissions.canViewApplications).toBe(false);
    expect(eff.modulePermissions).toEqual({ trackflow: ['trackflow:view'], inicio: ['inicio:view'] });
  });

  it('migração: os ajustes reproduzem exatamente o acesso atual', () => {
    const profile = { permissions: ['canViewDocuments' as const, 'canViewApplications' as const], modules: { trackflow: ['trackflow:view'] } };
    const current = {
      permissions: { ...DEFAULT_PERMISSIONS, canManageVacation: true, canViewRegrasComerciais: false },
      modulePermissions: { 'portal-cliente': ['portal-cliente:view'] },
    };
    const overrides = overridesToMatch(profile, current, DEFAULT_PERMISSIONS);
    expect(overrides.modules).toEqual({ trackflow: null, 'portal-cliente': ['portal-cliente:view'] });
    expect(sameAccess(effectiveAccess(profile, overrides), current, DEFAULT_PERMISSIONS)).toBe(true);
    expect(sameAccess(effectiveAccess(profile), current, DEFAULT_PERMISSIONS)).toBe(false);
  });
});
