import {
  FALLBACK_HUB_MODULES,
  RESERVED_SLUGS,
  isAllowedModuleOrigin,
  isEmbeddedModule,
  parseHubModules,
  resolveModuleAccess,
  type EmbeddedHubModule,
} from '@/config/modules';

const embedded = (overrides: Partial<EmbeddedHubModule> = {}): EmbeddedHubModule => ({
  id: 'mod',
  kind: 'embedded',
  label: 'Mod',
  iconName: 'Puzzle',
  order: 0,
  enabled: true,
  showInNav: true,
  href: '/mod',
  noZoom: true,
  external: false,
  slug: 'mod',
  url: 'https://mod.azurewebsites.net',
  embedPath: '/embed',
  accessMode: 'explicit',
  defaultPermissions: [],
  adminPermissions: [],
  permissionCatalog: [],
  layout: 'fullscreen',
  ...overrides,
});

describe('registro padrão (seed)', () => {
  it('é válido, ordenado e tem ids únicos', () => {
    expect(FALLBACK_HUB_MODULES.length).toBeGreaterThan(0);
    const ids = FALLBACK_HUB_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const orders = FALLBACK_HUB_MODULES.map((m) => m.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  it('módulos embarcados têm href = /slug, slug livre e URL permitida pela CSP', () => {
    for (const mod of FALLBACK_HUB_MODULES.filter(isEmbeddedModule)) {
      expect(mod.href).toBe(`/${mod.slug}`);
      expect(RESERVED_SLUGS as readonly string[]).not.toContain(mod.slug);
      expect(isAllowedModuleOrigin(mod.url, false)).toBe(true);
    }
  });

  it('mantém os endereços atuais dos módulos', () => {
    const hrefs = Object.fromEntries(FALLBACK_HUB_MODULES.map((m) => [m.id, m.href]));
    expect(hrefs['trackflow']).toBe('/trackflow');
    expect(hrefs['portal-repasse']).toBe('/dados-estrategicos');
    expect(hrefs['portal-cliente']).toBe('/portal-cliente');
  });
});

describe('resolveModuleAccess', () => {
  it('explicit: só com <id>:view', () => {
    const mod = embedded();
    expect(resolveModuleAccess(mod, undefined).hasAccess).toBe(false);
    expect(resolveModuleAccess(mod, []).hasAccess).toBe(false);
    expect(resolveModuleAccess(mod, ['mod:export']).hasAccess).toBe(false);
    expect(resolveModuleAccess(mod, ['mod:view', 'mod:export'])).toEqual({
      hasAccess: true,
      permissions: ['mod:view', 'mod:export'],
    });
  });

  it('all: sem registro usa o padrão; lista vazia revoga', () => {
    const mod = embedded({ accessMode: 'all', defaultPermissions: ['mod:view'] });
    expect(resolveModuleAccess(mod, undefined)).toEqual({ hasAccess: true, permissions: ['mod:view'] });
    expect(resolveModuleAccess(mod, []).hasAccess).toBe(false);
    expect(resolveModuleAccess(mod, ['mod:view', 'mod:manage']).permissions).toContain('mod:manage');
  });
});

describe('isAllowedModuleOrigin', () => {
  it('aceita só https nos domínios da CSP', () => {
    expect(isAllowedModuleOrigin('https://x.azurewebsites.net', false)).toBe(true);
    expect(isAllowedModuleOrigin('https://app.venetomfo.com.br', false)).toBe(true);
    expect(isAllowedModuleOrigin('http://x.azurewebsites.net', false)).toBe(false);
    expect(isAllowedModuleOrigin('https://evil.com', false)).toBe(false);
    expect(isAllowedModuleOrigin('https://azurewebsites.net.evil.com', false)).toBe(false);
  });

  it('localhost só quando permitido', () => {
    expect(isAllowedModuleOrigin('http://localhost:3002', false)).toBe(false);
    expect(isAllowedModuleOrigin('http://localhost:3002', true)).toBe(true);
  });
});

describe('parseHubModules', () => {
  it('descarta documentos inválidos e ordena', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parseHubModules([
      embedded({ id: 'bb', slug: 'bb', href: '/bb', order: 2 }),
      { id: 'quebrado', kind: 'embedded' },
      embedded({ id: 'aa', slug: 'aa', href: '/aa', order: 1 }),
    ]);
    expect(result.map((m) => m.id)).toEqual(['aa', 'bb']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
