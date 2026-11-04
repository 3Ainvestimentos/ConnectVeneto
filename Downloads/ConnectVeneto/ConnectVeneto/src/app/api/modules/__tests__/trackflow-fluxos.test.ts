/**
 * @jest-environment node
 *
 * Testes para GET /api/modules/trackflow/fluxos (proxy do catálogo de fluxos do TrackFlow).
 * Sem documento em `hubModules`, vale o seed embutido (src/config/hub-modules.seed.json).
 */
import { GET } from '@/app/api/modules/trackflow/fluxos/route';
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

/** hubModules/{id}: documentos configuráveis por teste (ausente = usa o seed). */
const mockHubModuleDocs: Record<string, Record<string, unknown>> = {};
const mockCollabQueryGet = jest.fn().mockResolvedValue({ empty: true, docs: [] });

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn((name: string) => ({
      doc: jest.fn((id: string) => ({
        get: async () => (name === 'hubModules' && mockHubModuleDocs[id]
          ? { exists: true, data: () => mockHubModuleDocs[id] }
          : { exists: false, data: () => undefined }),
      })),
      where: jest.fn(() => ({ limit: jest.fn(() => ({ get: mockCollabQueryGet })) })),
    })),
  })),
}));

const mockRequireCorporateUser = jest.fn();
jest.mock('@/lib/security', () => ({
  requireCorporateUser: (...args: unknown[]) => mockRequireCorporateUser(...args),
}));

function decodePayload(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}

function makeRequest() {
  return {
    headers: { get: (h: string) => (h.toLowerCase() === 'authorization' ? 'Bearer firebase-id-token' : null) },
  } as unknown as Request;
}

const FLUXOS = {
  fluxos: [{
    id: 'f1', sigla: 'SGT', nome: 'Solicitações Gerais Tecnologia', descricao: null,
    areaId: 'a1', areaNome: 'Tecnologia e Dados', path: '/fluxos/f1/abrir',
  }],
};

const fetchMock = jest.fn();

describe('GET /api/modules/trackflow/fluxos', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    __resetHubModuleCache();
    process.env.HUB_JWT_SECRET = 'test-secret-0123456789abcdef0123456789abcdef0123456789abcdef0123';
    for (const key of Object.keys(mockHubModuleDocs)) delete mockHubModuleDocs[key];
    mockCollabQueryGet.mockReset().mockResolvedValue({ empty: true, docs: [] });
    mockRequireCorporateUser.mockResolvedValue({ uid: 'user-uid-123', email: 'test@venetomfo.com.br' });
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => FLUXOS });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('encaminha ao TrackFlow com hub JWT de 60 s e devolve os fluxos', async () => {
    mockCollabQueryGet.mockResolvedValueOnce({ empty: false, docs: [{ data: () => ({ name: 'Test User' }) }] });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(FLUXOS);

    const [url, init] = fetchMock.mock.calls[0];
    const trackflowUrl = (getFallbackHubModule('trackflow') as { url: string }).url.replace(/\/$/, '');
    expect(url).toBe(`${trackflowUrl}/api/hub/fluxos`);
    expect(init.signal).toBeDefined();

    const token = (init.headers.Authorization as string).replace(/^Bearer /, '');
    const payload = decodePayload(token);
    expect(payload).toMatchObject({
      iss: 'connect-veneto',
      aud: 'trackflow',
      sub: 'user-uid-123',
      email: 'test@venetomfo.com.br',
      name: 'Test User',
    });
    expect((payload.exp as number) - (payload.iat as number)).toBe(60);
  });

  it('401 sem usuário corporativo, sem chamar o TrackFlow', async () => {
    mockRequireCorporateUser.mockRejectedValueOnce(new Error('UNAUTHORIZED'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('404 com o TrackFlow desativado no registro', async () => {
    mockHubModuleDocs['trackflow'] = { ...getFallbackHubModule('trackflow'), enabled: false };
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('repassa o status de erro do TrackFlow', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
  });

  it('504 com o TrackFlow fora do ar ou em timeout', async () => {
    fetchMock.mockRejectedValueOnce(new Error('The operation was aborted due to timeout'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(504);
  });
});
