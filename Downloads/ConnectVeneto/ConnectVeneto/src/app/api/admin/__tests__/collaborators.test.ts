/**
 * @jest-environment node
 *
 * Testes para PATCH/DELETE /api/admin/collaborators — edição e exclusão pelo RH
 * (`collaboratorAdminEmails`), que as rules do Firestore não permitem.
 */
import { PATCH, DELETE } from '@/app/api/admin/collaborators/route';

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

const mockRequireCollaboratorAdmin = jest.fn();
const SUPER_ADMIN_EMAIL = 'chefe@venetomfo.com.br';

jest.mock('@/lib/security', () => ({
  ...jest.requireActual('@/lib/security'),
  requireCollaboratorAdmin: (...args: unknown[]) => mockRequireCollaboratorAdmin(...args),
  isSuperAdminAddress: async (email: string) => email === SUPER_ADMIN_EMAIL,
}));

type Doc = Record<string, unknown>;
let store: Record<string, Doc>;

const mockBatchUpdate = jest.fn();
const mockBatchCreate = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({
    collection: (name: string) => ({
      doc: (id?: string) => ({
        id: id ?? 'auto-id',
        path: `${name}/${id ?? 'auto-id'}`,
        get: async () => ({ exists: !!id && id in store, data: () => (id ? store[id] : undefined) }),
      }),
      where: (_field: string, _op: string, value: unknown) => ({
        limit: () => ({
          get: async () => {
            const docs = Object.entries(store)
              .filter(([, doc]) => doc.email === value)
              .map(([id]) => ({ id }));
            return { empty: docs.length === 0, docs };
          },
        }),
      }),
    }),
    batch: () => ({
      update: mockBatchUpdate,
      create: mockBatchCreate,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    }),
  })),
  FieldValue: { increment: (n: number) => ({ increment: n }) },
}));

function makeRequest(id: string | null, body?: unknown) {
  const url = `https://intranet.test/api/admin/collaborators${id ? `?id=${id}` : ''}`;
  return {
    url,
    headers: { get: () => 'Bearer token' },
    json: async () => body,
  } as unknown as Request;
}

const asRh = () =>
  mockRequireCollaboratorAdmin.mockResolvedValue({ uid: 'rh', email: 'rh@venetomfo.com.br', isSuperAdmin: false });
const asSuperAdmin = () =>
  mockRequireCollaboratorAdmin.mockResolvedValue({ uid: 'sa', email: SUPER_ADMIN_EMAIL, isSuperAdmin: true });

beforeEach(() => {
  jest.clearAllMocks();
  store = {
    c1: { name: 'Fulano', email: 'fulano@venetomfo.com.br', area: 'Canal MFO', permissions: { canManageSystem: false } },
    c2: { name: 'Beltrano', email: 'beltrano@venetomfo.com.br', area: 'RH' },
    boss: { name: 'Chefe', email: SUPER_ADMIN_EMAIL, area: 'Diretoria' },
  };
});

describe('PATCH /api/admin/collaborators', () => {
  it('RH edita campos de cadastro e o log de auditoria vai junto no batch', async () => {
    asRh();
    const res = await PATCH(makeRequest('c1', { area: 'Gestão', name: 'Fulano' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, changed: 1 });
    expect(mockBatchUpdate).toHaveBeenCalledWith(expect.objectContaining({ path: 'collaborators/c1' }), { area: 'Gestão' });
    expect(mockBatchCreate).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'collaborator_logs/auto-id' }),
      expect.objectContaining({
        collaboratorId: 'c1',
        updatedBy: 'rh@venetomfo.com.br',
        changes: [{ field: 'area', oldValue: 'Canal MFO', newValue: 'Gestão' }],
      })
    );
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('recusa permissões e outros campos fora do cadastro', async () => {
    asRh();
    const res = await PATCH(makeRequest('c1', { permissions: { canManageSystem: true } }));
    expect(res.status).toBe(400);
    expect(mockBatchCommit).not.toHaveBeenCalled();

    const res2 = await PATCH(makeRequest('c1', { authUid: 'outro' }));
    expect(res2.status).toBe(400);
  });

  it('recusa e-mail já usado por outro colaborador', async () => {
    asRh();
    const res = await PATCH(makeRequest('c1', { email: 'Beltrano@venetomfo.com.br' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/outro colaborador/);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('recusa URL que não seja http(s)', async () => {
    asRh();
    const res = await PATCH(makeRequest('c1', { photoURL: 'javascript:alert(1)' }));
    expect(res.status).toBe(400);
  });

  it('RH não altera o cadastro de super admin; super admin altera', async () => {
    asRh();
    expect((await PATCH(makeRequest('boss', { area: 'X' }))).status).toBe(403);

    asSuperAdmin();
    expect((await PATCH(makeRequest('boss', { area: 'X' }))).status).toBe(200);
  });

  it('sem mudança real não grava nada', async () => {
    asRh();
    const res = await PATCH(makeRequest('c1', { name: 'Fulano' }));
    expect(await res.json()).toEqual({ ok: true, changed: 0 });
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('404 para colaborador inexistente e 400 sem id', async () => {
    asRh();
    expect((await PATCH(makeRequest('nao-existe', { area: 'X' }))).status).toBe(404);
    expect((await PATCH(makeRequest(null, { area: 'X' }))).status).toBe(400);
  });

  it('quem não é RH nem super admin recebe 403', async () => {
    mockRequireCollaboratorAdmin.mockRejectedValue(new Error('FORBIDDEN_COLLABORATOR_ADMIN_REQUIRED'));
    expect((await PATCH(makeRequest('c1', { area: 'X' }))).status).toBe(403);
  });
});

describe('DELETE /api/admin/collaborators', () => {
  it('RH exclui e a versão da tabela é incrementada no mesmo batch', async () => {
    asRh();
    const res = await DELETE(makeRequest('c2'));

    expect(res.status).toBe(200);
    expect(mockBatchDelete).toHaveBeenCalledWith(expect.objectContaining({ path: 'collaborators/c2' }));
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'systemSettings/config' }),
      { collaboratorTableVersion: { increment: 1 } }
    );
  });

  it('RH não exclui super admin', async () => {
    asRh();
    expect((await DELETE(makeRequest('boss'))).status).toBe(403);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });
});
