import { canSeeHubModule, isNoZoomPath, type NavAccessContext } from '@/components/layout/navigation';
import { FALLBACK_HUB_MODULES, type HubModule } from '@/config/modules';
import type { CollaboratorPermissions } from '@/contexts/CollaboratorsContext';

const byId = (id: string) => FALLBACK_HUB_MODULES.find((m) => m.id === id) as HubModule;

const ctx = (overrides: Partial<NavAccessContext> = {}): NavAccessContext => ({
  permissions: { canViewDocuments: true, canViewApplications: true } as CollaboratorPermissions,
  modulePermissions: {},
  isSuperAdmin: false,
  ...overrides,
});

const visibleIds = (c: NavAccessContext) =>
  FALLBACK_HUB_MODULES.filter((m) => canSeeHubModule(m, c)).map((m) => m.id);

describe('canSeeHubModule', () => {
  it('colaborador comum vê páginas liberadas e o TrackFlow, na ordem do registro', () => {
    expect(visibleIds(ctx())).toEqual(['dashboard', 'trackflow', 'applications', 'documents']);
  });

  it('módulo explicit aparece só com <id>:view', () => {
    const c = ctx({ modulePermissions: { 'portal-repasse': ['portal-repasse:view'] } });
    expect(canSeeHubModule(byId('portal-repasse'), c)).toBe(true);
    expect(canSeeHubModule(byId('portal-cliente'), c)).toBe(false);
  });

  it('TrackFlow some quando o acesso foi revogado com lista vazia', () => {
    expect(canSeeHubModule(byId('trackflow'), ctx({ modulePermissions: { trackflow: [] } }))).toBe(false);
  });

  it('super admin vê todos os módulos embarcados ativos', () => {
    const c = ctx({ isSuperAdmin: true });
    expect(canSeeHubModule(byId('portal-repasse'), c)).toBe(true);
    expect(canSeeHubModule(byId('portal-cliente'), c)).toBe(true);
  });

  it('item desativado ou fora do menu não aparece nem para super admin', () => {
    const c = ctx({ isSuperAdmin: true, permissions: { canViewBI: true } as CollaboratorPermissions });
    expect(canSeeHubModule(byId('bi'), c)).toBe(false);
    expect(canSeeHubModule({ ...byId('trackflow'), showInNav: false }, c)).toBe(false);
  });

  it('altPermissions também liberam o item', () => {
    const c = ctx({ permissions: { canViewBibliotecaComercial: true } as CollaboratorPermissions });
    expect(canSeeHubModule(byId('documents'), c)).toBe(true);
  });
});

describe('isNoZoomPath', () => {
  it('usa noZoom do registro e as rotas fixas', () => {
    expect(isNoZoomPath('/trackflow', FALLBACK_HUB_MODULES)).toBe(true);
    expect(isNoZoomPath('/dados-estrategicos/admin', FALLBACK_HUB_MODULES)).toBe(true);
    expect(isNoZoomPath('/personal-panel', FALLBACK_HUB_MODULES)).toBe(true);
    expect(isNoZoomPath('/dashboard', FALLBACK_HUB_MODULES)).toBe(false);
  });
});
