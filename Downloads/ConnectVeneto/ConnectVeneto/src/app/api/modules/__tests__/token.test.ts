/**
 * @jest-environment node
 *
 * Testes para POST /api/modules/[moduleId]/token
 * Verifica que o endpoint emite tokens corretamente para módulos registrados,
 * incluindo o portal-repasse com seu modelo de permissões granulares.
 * Ref: CONNECTVENETO_MODULE_PROTOCOL.md §14
 */
import { POST } from '@/app/api/modules/[moduleId]/token/route';

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

const mockFirestoreGet = jest.fn().mockResolvedValue({
  data: () => ({ superAdminEmails: [] }),
});
const mockDoc = jest.fn(() => ({ get: mockFirestoreGet }));

// Mock separado para query de colaboradores — configurável por teste
const mockCollabQueryGet = jest.fn().mockResolvedValue({ empty: true, docs: [] });

const mockCollection = jest.fn(() => ({
  doc:   mockDoc,
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

/** Simula colaborador com acesso ao portal-repasse */
function mockCollabWithAccess(extraModulePerms: string[] = []) {
  mockCollabQueryGet.mockResolvedValueOnce({
    empty: false,
    docs: [{
      data: () => ({
        name: 'Test User',
        permissions: { canViewPortalRepasse: true },
        modulePermissions: {
          'portal-repasse': ['portal-repasse:view', ...extraModulePerms],
        },
      }),
    }],
  });
}

describe('POST /api/modules/[moduleId]/token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestoreGet.mockResolvedValue({ data: () => ({ superAdminEmails: [] }) });
    mockCollabQueryGet.mockResolvedValue({ empty: true, docs: [] });
    mockRequireCorporateUser.mockResolvedValue({
      uid:   'user-uid-123',
      email: 'test@venetomfo.com.br',
    });
  });

  it('retorna 404 para módulo não registrado', async () => {
    const res = await POST(makeRequest(), makeParams('modulo-inexistente'));
    expect(res.status).toBe(404);
  });

  it('retorna 401 quando usuário não está autenticado', async () => {
    mockRequireCorporateUser.mockRejectedValueOnce(new Error('UNAUTHORIZED'));
    mockCollabWithAccess();
    const res = await POST(makeRequest(), makeParams('portal-repasse'));
    expect(res.status).toBe(401);
  });

  it('emite token para trackflow (módulo legado com defaultPermissions)', async () => {
    const res  = await POST(makeRequest(), makeParams('trackflow'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.token).toBe('string');
    expect(body.token.split('.').length).toBe(3);
  });

  it('retorna 403 para portal-repasse quando usuário não tem canViewPortalRepasse', async () => {
    // mockCollabQueryGet já retorna { empty: true } por padrão no beforeEach
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
    expect(Array.isArray(payload['permissions'])).toBe(true);
    expect((payload['permissions'] as string[]).includes('portal-repasse:view')).toBe(true);
    expect((payload['permissions'] as string[]).includes('portal-repasse:tickets:view')).toBe(true);
  });

  it('portal-repasse token expira em 15 minutos', async () => {
    mockCollabWithAccess();

    const res  = await POST(makeRequest(), makeParams('portal-repasse'));
    const body = await res.json();

    const payload = decodePayload(body.token);
    const ttl = (payload.exp as number) - (payload.iat as number);
    expect(ttl).toBe(15 * 60);
  });

  it('sem modulePermissions definidas recebe apenas portal-repasse:view', async () => {
    // Colaborador com acesso mas sem modulePermissions explícito
    mockCollabQueryGet.mockResolvedValueOnce({
      empty: false,
      docs: [{
        data: () => ({
          name: 'Minimal User',
          permissions: { canViewPortalRepasse: true },
          modulePermissions: {},
        }),
      }],
    });

    const res  = await POST(makeRequest(), makeParams('portal-repasse'));
    expect(res.status).toBe(200);
    const body = await res.json();
    const perms = decodePayload(body.token)['permissions'] as string[];
    expect(perms).toEqual(['portal-repasse:view']);
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
