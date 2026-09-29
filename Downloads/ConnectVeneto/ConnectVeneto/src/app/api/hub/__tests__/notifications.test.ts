/**
 * @jest-environment node
 *
 * Testes para POST /api/hub/notifications e /api/hub/notifications/resolve.
 * A origem (source) sempre vem do issuer do JWT do módulo, nunca do corpo.
 * Ref: CONNECTVENETO_MODULE_PROTOCOL.md §Notificações
 */
import { SignJWT } from 'jose';
import { POST as createRoute } from '@/app/api/hub/notifications/route';
import { POST as resolveRoute } from '@/app/api/hub/notifications/resolve/route';
import { normalizeRecipients, notificationDocId } from '@/lib/notifications/server';
import { isSafeRelativePath } from '@/lib/notifications/types';
import { __resetHubModuleCache } from '@/lib/hub-modules/server';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    })),
  },
}));

jest.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminApp: jest.fn(() => ({})),
}));

const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockResolveDocs: Array<{ ref: string; get: (k: string) => unknown }> = [];

const mockCollection = jest.fn((name: string) => ({
  doc: jest.fn((id?: string) =>
    name === 'hubModules'
      ? { get: async () => ({ exists: false, data: () => undefined }) }
      : { id: id ?? 'auto-id' },
  ),
  where: jest.fn(() => ({
    where: jest.fn(() => ({ get: async () => ({ docs: mockResolveDocs }) })),
  })),
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({
    collection: mockCollection,
    batch: () => ({ set: mockBatchSet, update: mockBatchUpdate, commit: mockBatchCommit }),
  })),
  FieldValue: { serverTimestamp: () => 'SERVER_TS' },
}));

const SECRET = 'test-secret-0123456789abcdef0123456789abcdef0123456789abcdef0123';

async function moduleToken(issuer: string, audience = 'connect-veneto') {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime('60s')
    .sign(new TextEncoder().encode(SECRET));
}

function makeRequest(body: unknown, token?: string) {
  return {
    headers: { get: (h: string) => (h.toLowerCase() === 'authorization' && token ? `Bearer ${token}` : null) },
    json: async () => body,
  } as unknown as Request;
}

const validBody = {
  recipients: ['Fulano@VenetoMFO.com.br', 'externo@gmail.com'],
  title: 'Nova solicitação: Relatório',
  body: 'Maria · prazo 01/10 18:00',
  path: '/solicitations/abc',
  externalRef: 'abc',
  readPolicy: 'on_resolve',
};

describe('helpers', () => {
  it('normaliza, deduplica e descarta e-mails fora do domínio corporativo', () => {
    expect(normalizeRecipients([' A@venetomfo.com.br', 'a@VENETOMFO.com.br', 'x@gmail.com'])).toEqual([
      'a@venetomfo.com.br',
    ]);
  });

  it('gera ID determinístico por (source, externalRef, email)', () => {
    const a = notificationDocId('trackflow', 'abc', 'a@venetomfo.com.br');
    expect(a).toBe(notificationDocId('trackflow', 'abc', 'a@venetomfo.com.br'));
    expect(a).not.toBe(notificationDocId('trackflow', 'abc', 'b@venetomfo.com.br'));
    expect(a.startsWith('trackflow_')).toBe(true);
  });

  it('aceita só caminhos relativos internos', () => {
    expect(isSafeRelativePath('/solicitations/1')).toBe(true);
    expect(isSafeRelativePath('//evil.com')).toBe(false);
    expect(isSafeRelativePath('/\\evil.com')).toBe(false);
    expect(isSafeRelativePath('https://evil.com')).toBe(false);
  });
});

describe('POST /api/hub/notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetHubModuleCache();
    process.env.HUB_JWT_SECRET = SECRET;
  });

  it('401 sem token', async () => {
    const res = await createRoute(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it('401 com audience errada', async () => {
    const res = await createRoute(makeRequest(validBody, await moduleToken('trackflow', 'outro')));
    expect(res.status).toBe(401);
  });

  it('404 para módulo não registrado', async () => {
    const res = await createRoute(makeRequest(validBody, await moduleToken('modulo-inexistente')));
    expect(res.status).toBe(404);
  });

  it('400 quando on_resolve vem sem externalRef', async () => {
    const res = await createRoute(
      makeRequest({ ...validBody, externalRef: undefined }, await moduleToken('trackflow')),
    );
    expect(res.status).toBe(400);
  });

  it('400 para path absoluto', async () => {
    const res = await createRoute(
      makeRequest({ ...validBody, path: '//evil.com' }, await moduleToken('trackflow')),
    );
    expect(res.status).toBe(400);
  });

  it('cria uma notificação por destinatário corporativo, com source do issuer', async () => {
    const res = await createRoute(
      makeRequest({ ...validBody, source: 'forjado' }, await moduleToken('trackflow')),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ created: 1 });
    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    const [ref, data] = mockBatchSet.mock.calls[0];
    expect(ref.id).toBe(notificationDocId('trackflow', 'abc', 'fulano@venetomfo.com.br'));
    expect(data).toMatchObject({
      recipientEmail: 'fulano@venetomfo.com.br',
      source: 'trackflow',
      link: { moduleId: 'trackflow', path: '/solicitations/abc' },
      readPolicy: 'on_resolve',
      read: false,
    });
  });
});

describe('POST /api/hub/notifications/resolve', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HUB_JWT_SECRET = SECRET;
    mockResolveDocs.length = 0;
  });

  it('401 sem token', async () => {
    const res = await resolveRoute(makeRequest({ externalRef: 'abc' }));
    expect(res.status).toBe(401);
  });

  it('marca como lidas só as não lidas', async () => {
    mockResolveDocs.push(
      { ref: 'r1', get: (k) => ({ read: false, recipientEmail: 'a@venetomfo.com.br' })[k] },
      { ref: 'r2', get: (k) => ({ read: true, recipientEmail: 'b@venetomfo.com.br' })[k] },
    );
    const res = await resolveRoute(makeRequest({ externalRef: 'abc' }, await moduleToken('trackflow')));
    expect(await res.json()).toEqual({ resolved: 1 });
    expect(mockBatchUpdate).toHaveBeenCalledWith('r1', { read: true, readAt: 'SERVER_TS', resolvedAt: 'SERVER_TS' });
  });
});
