/**
 * @jest-environment node
 *
 * Testes para POST /api/modules/[moduleId]/token
 * O registro de módulos vem de `hubModules` (Firestore); sem documento, vale o seed
 * embutido (src/config/hub-modules.seed.json). O acesso mora em
 * `collaborator.modulePermissions[moduleId]`.
 * Ref: CONNECTVENETO_MODULE_PROTOCOL.md §14
 */
import { POST } from '@/app/api/modules/[moduleId]/token/route';
import { __resetHubModuleCache } from '@/lib/hub-modules/server';
import { getFallbackHubModule } from '@/config/modules';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data: unknown, init?: { status?: number; headers?: unknown }) => ({
      status: init?.status ?? 200,
      json:   async () => data,
    })),
  },
}));

jest.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminApp: jest.fn(() => ({})),
}));

/** systemSettings/* */
const mockFirestoreGet = jest.fn().mockResolvedValue({
  data: () => ({ superAdminEmails: [] }),
});

/** hubModules/{id}: documentos configuráveis por teste (ausente = usa o seed). */
const mockHubModuleDocs: Record<string, Record<string, unknown>> = {};

// Mock separado para query de colaboradores — configurável por teste
const mockCollabQueryGet = jest.fn().mockResolvedValue({ empty: true, docs: [] });

const mockCollection = jest.fn((name: string) => ({
  doc: jest.fn((id: string) => ({
    get: name === 'hubModules'
      ? async () => (mockHubModuleDocs[id]
        ? { exists: true, data: () => mockHubModuleDocs[id] }
        : { exists: false, data: () => undefined })
      : mockFirestoreGet,
  })),
  where: jest.fn(() => ({
    limit: jest.fn(() => ({
      get: mockCollabQueryGet,
    })),
  })),
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({ collection: mockCollection })),
}));

jest.mock('@/lib/email-utils', () => ({
  normalizeEmail: jest.fn((e: string) => e.toLowerCase()),
}));

const mockRequireCorporateUser = jest.fn();
jest.mock('@/lib/security', () => ({
  requireCorporateUser: (...args: unknown[]) => mockRequireCorporateUser(...args),
}));

/** Decodifica o payload JWT sem verificar a assinatura. */
function decodePayload(token: string): Record<string, unknown> {
  const b64 = token.split('.')[1];
  return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
}

function makeParams(moduleId: string) {
  return { params: Promise.resolve({ moduleId }) };
}

function makeRequest() {
  return {
    headers: { get: (h: string) => (h.toLowerCase() === 'authorization' ? 'Bearer firebase-id-token' : null) },
    json: async () => ({}),
  } as unknown as Request;
}

function mockCollab(data: Record<string, unknown>) {
  mockCollabQueryGet.mockResolvedValueOnce({
    empty: false,
    docs: [{ data: () => ({ name: 'Test User', ...data }) }],
  });
}

/** Simula colaborador com acesso ao portal-repasse */
function mockCollabWithAccess(extraModulePerms: string[] = []) {
  mockCollab({
    modulePermissions: {
      'portal-repasse': ['portal-repasse:view', ...extraModulePerms],
    },
  });
}

describe('POST /api/modules/[moduleId]/token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetHubModuleCache();
    process.env.HUB_JWT_SECRET = 'test-secret-0123456789abcdef0123456789abcdef0123456789abcdef0123';
    for (const key of Object.keys(mockHubModuleDocs)) delete mockHubModuleDocs[key];
    mockFirestoreGet.mockResolvedValue({ data: () => ({ superAdminEmails: [] }) });
    mockCollabQueryGet.mockReset().mockResolvedValue({ empty: true, docs: [] });
    mockRequireCorporateUser.mockResolvedValue({
      uid:   'user-uid-123',
      email: 'test@venetomfo.com.br',
    });
  });

  it('retorna 404 para módulo não registrado', async () => {
    const res = await POST(makeRequest(), makeParams('modulo-inexistente'));
    expect(res.status).toBe(404);
  });

  it('retorna 404 para página interna (não é módulo embarcado)', async () => {
    const res = await POST(makeRequest(), makeParams('dashboard'));
    expect(res.status).toBe(404);
  });

  it('retorna 404 para módulo desativado no banco', async () => {
    mockHubModuleDocs['portal-repasse'] = { ...getFallbackHubModule('portal-repasse'), enabled: false };
    mockCollabWithAccess();
    const res = await POST(makeRequest(), makeParams('portal-repasse'));
    expect(res.status).toBe(404);
  });

  it('retorna 401 quando usuário não está autenticado', async () => {
    mockRequireCorporateUser.mockRejectedValueOnce(new Error('UNAUTHORIZED'));
    mockCollabWithAccess();
    const res = await POST(makeRequest(), makeParams('portal-repasse'));
    expect(res.status).toBe(401);
  });

  it('emite token para trackflow com defaultPermissions quando não há registro próprio', async () => {
    const res  = await POST(makeRequest(), makeParams('trackflow'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token.split('.').length).toBe(3);
    expect(decodePayload(body.token)['permissions']).toEqual(['trackflow:view', 'trackflow:create']);
  });

  it('trackflow honra modulePermissions do colaborador', async () => {
    mockCollab({
      modulePermissions: { trackflow: ['trackflow:view', 'trackflow:create', 'trackflow:manage'] },
    });
    const res   = await POST(makeRequest(), makeParams('trackflow'));
    const perms = decodePayload((await res.json()).token)['permissions'] as string[];
    expect(perms).toContain('trackflow:manage');
  });

  it('trackflow com lista vazia em modulePermissions = acesso revogado (403)', async () => {
    mockCollab({ modulePermissions: { trackflow: [] } });
    const res = await POST(makeRequest(), makeParams('trackflow'));
    expect(res.status).toBe(403);
  });

  it('retorna 403 para portal-repasse quando colaborador não existe', async () => {
    const res = await POST(makeRequest(), makeParams('portal-repasse'));
    expect(res.status).toBe(403);
  });

  it('retorna 403 para portal-repasse quando só existe o booleano legado', async () => {
    mockCollab({ permissions: { canViewPortalRepasse: true }, modulePermissions: {} });
    const res = await POST(makeRequest(), makeParams('portal-repasse'));
    expect(res.status).toBe(403);
  });

  it('emite token JWT para portal-repasse com claims corretos', async () => {
    mockCollabWithAccess(['portal-repasse:tickets:view']);

    const res  = await POST(makeRequest(), makeParams('portal-repasse'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.token).toBe('string');

    const payload = decodePayload(body.token);
    expect(payload.sub).toBe('user-uid-123');
    expect(payload['email']).toBe('test@venetomfo.com.br');
    expect(payload['iss']).toBe('connect-veneto');
    expect(payload['aud']).toBe('portal-repasse');
    expect(payload['role']).toBe('member');
    expect(payload['permissions']).toEqual(['portal-repasse:view', 'portal-repasse:tickets:view']);
  });

  it('portal-repasse token expira em 15 minutos', async () => {
    mockCollabWithAccess();

    const res  = await POST(makeRequest(), makeParams('portal-repasse'));
    const body = await res.json();

    const payload = decodePayload(body.token);
    const ttl = (payload.exp as number) - (payload.iat as number);
    expect(ttl).toBe(15 * 60);
  });

  it('módulo novo cadastrado só no banco emite token', async () => {
    mockHubModuleDocs['novo-modulo'] = {
      kind: 'embedded',
      label: 'Novo Módulo',
      iconName: 'Puzzle',
      order: 20,
      enabled: true,
      href: '/novo-modulo',
      slug: 'novo-modulo',
      url: 'https://novo-modulo.azurewebsites.net',
      accessMode: 'explicit',
    };
    mockCollab({ modulePermissions: { 'novo-modulo': ['novo-modulo:view'] } });

    const res = await POST(makeRequest(), makeParams('novo-modulo'));
    expect(res.status).toBe(200);
    const payload = decodePayload((await res.json()).token);
    expect(payload['aud']).toBe('novo-modulo');
    expect(payload['permissions']).toEqual(['novo-modulo:view']);
  });

  it('superadmin recebe adminPermissions do portal-repasse', async () => {
    mockFirestoreGet.mockResolvedValue({
      data: () => ({ superAdminEmails: ['test@venetomfo.com.br'] }),
    });

    const res  = await POST(makeRequest(), makeParams('portal-repasse'));
    const body = await res.json();

    const payload = decodePayload(body.token);
    expect(payload['role']).toBe('superadmin');
    const perms = payload['permissions'] as string[];
    expect(perms).toContain('portal-repasse:manage');
    expect(perms).toContain('portal-repasse:export');
    expect(perms).toContain('portal-repasse:tickets:view');
    expect(perms).toContain('portal-repasse:params:view');
  });
});
