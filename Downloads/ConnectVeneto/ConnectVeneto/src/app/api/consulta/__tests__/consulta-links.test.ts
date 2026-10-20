/**
 * @jest-environment node
 *
 * Consulta Pessoal: link pessoal só do dono; links de tipo só pelos admins do tipo
 * (por e-mail ou pela área atual); Individual só para quem tem URL; Público do
 * Compartilhado resolvido pelo cadastro atual (quem entra na área vê, quem sai não).
 */
import { GET, POST, PATCH, DELETE } from '@/app/api/consulta/links/route';
import {
  GET as ADMIN_GET,
  POST as ADMIN_POST,
  PATCH as ADMIN_PATCH,
  DELETE as ADMIN_DELETE,
} from '@/app/api/consulta/admin/links/route';
import { PUT as VALUE_PUT, DELETE as VALUE_DELETE } from '@/app/api/consulta/admin/values/route';
import { POST as TYPE_POST, DELETE as TYPE_DELETE } from '@/app/api/consulta/types/route';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    })),
  },
}));

jest.mock('@/lib/firebase-admin', () => ({ getFirebaseAdminApp: jest.fn(() => ({})) }));

const SUPER = 'chefe@venetomfo.com.br';
const MESA_ADMIN = 'mesa.admin@venetomfo.com.br';
const ANA = 'ana@venetomfo.com.br';
const BRUNO = 'bruno@venetomfo.com.br';
const CARLA = 'carla@venetomfo.com.br';
const DIEGO = 'diego@venetomfo.com.br';

let currentEmail = ANA;

jest.mock('@/lib/security', () => ({
  ...jest.requireActual('@/lib/security'),
  requireCorporateUser: async () => ({ uid: 'u', email: currentEmail }),
  requireSuperAdmin: async () => {
    if (currentEmail !== SUPER) throw new Error('FORBIDDEN_SUPER_ADMIN_REQUIRED');
    return { uid: 'u', email: currentEmail };
  },
  isSuperAdminAddress: async (email: string) => email === SUPER,
  logSecurityEvent: jest.fn(),
}));

type Doc = Record<string, unknown>;
let db: Record<string, Record<string, Doc>>;
let autoId = 0;

type Filter = [string, string, unknown];
const matchesFilter = (doc: Doc, [field, op, value]: Filter) =>
  op === 'in' ? (value as unknown[]).includes(doc[field] ?? null) : (doc[field] ?? null) === value;

jest.mock('firebase-admin/firestore', () => {
  const docRef = (name: string, id: string) => {
    const coll = () => (db[name] ??= {});
    return {
      id,
      path: `${name}/${id}`,
      get: async () => ({ exists: id in coll(), data: () => coll()[id] }),
      set: async (data: Doc) => { coll()[id] = data; },
      update: async (data: Doc) => { coll()[id] = { ...coll()[id], ...data }; },
      delete: async () => { delete coll()[id]; },
    };
  };
  const query = (name: string, filters: Filter[]) => ({
    where: (field: string, op: string, value: unknown) => query(name, [...filters, [field, op, value]]),
    limit: () => query(name, filters),
    get: async () => {
      const entries = Object.entries(db[name] ?? {}).filter(([, doc]) => filters.every((f) => matchesFilter(doc, f)));
      return {
        empty: entries.length === 0,
        size: entries.length,
        docs: entries.map(([id, data]) => ({ id, data: () => data, ref: docRef(name, id) })),
      };
    },
  });
  return {
    getFirestore: jest.fn(() => ({
      collection: (name: string) => ({
        ...query(name, []),
        doc: (id?: string) => docRef(name, id ?? `auto-${++autoId}`),
      }),
      batch: () => {
        const ops: (() => Promise<void>)[] = [];
        return {
          delete: (ref: { delete: () => Promise<void> }) => ops.push(() => ref.delete()),
          commit: async () => { for (const op of ops) await op(); },
        };
      },
    })),
  };
});

const request = (path: string, body?: unknown) =>
  ({
    url: `https://intranet.test${path}`,
    headers: { get: () => 'Bearer token' },
    json: async () => body,
  }) as unknown as Request;

const as = (email: string) => { currentEmail = email; };
const ids = (links: { id: string }[]) => links.map((l) => l.id).sort();
const myLinks = async () => (await (await GET(request('/api/consulta/links'))).json()).links;

const audience = (partial: Partial<{ everyone: boolean; areas: string[]; teams: string[]; emails: string[] }>) => ({
  everyone: false, areas: [], teams: [], emails: [], ...partial,
});

beforeEach(() => {
  db = {
    collaborators: {
      c1: { name: 'Ana', email: ANA, area: 'Mesa de operações' },
      c2: { name: 'Bruno', email: BRUNO, area: 'Comercial', team: 'Time Sul' },
      c3: { name: 'Carla', email: CARLA, area: 'Comercial' },
      c4: { name: 'Diego', email: DIEGO, area: 'Risco e Compliance' },
    },
    consultaLinkTypes: {
      mesa: { name: 'MESA', description: '', adminEmails: [MESA_ADMIN], adminAreas: [], order: 0 },
      cx: { name: 'CX', description: '', adminEmails: [], adminAreas: ['risco e compliance'], order: 1 },
    },
    consultaLinks: {
      anaPessoal: { kind: 'personal', ownerEmail: ANA, typeId: null, title: 'Favorito da Ana', url: 'https://a.com' },
      brunoPessoal: { kind: 'personal', ownerEmail: BRUNO, typeId: null, title: 'Favorito do Bruno', url: 'https://b.com' },
      planilhaMesa: { kind: 'individual', ownerEmail: null, typeId: 'mesa', title: 'Planilha MESA', url: '', audience: null },
      mesaOps: {
        kind: 'shared', ownerEmail: null, typeId: 'mesa', title: 'Boletas', url: 'https://boletas.com',
        audience: audience({ areas: ['Mesa de Operacoes'] }), // grafia diferente do cadastro: casa sem acento/caixa
      },
      manualTodos: { kind: 'shared', ownerEmail: null, typeId: 'mesa', title: 'Manual', url: 'https://manual.com', audience: audience({ everyone: true }) },
      comercialArea: { kind: 'shared', ownerEmail: null, typeId: 'mesa', title: 'Painel Comercial', url: 'https://c.com', audience: audience({ areas: ['Comercial'] }) },
      timeSul: { kind: 'shared', ownerEmail: null, typeId: 'cx', title: 'Time Sul', url: 'https://s.com', audience: audience({ teams: ['time sul'] }) },
      soCarla: { kind: 'shared', ownerEmail: null, typeId: 'cx', title: 'Só Carla', url: 'https://k.com', audience: audience({ emails: [CARLA] }) },
    },
    consultaLinkValues: {
      [`planilhaMesa__${ANA}`]: { linkId: 'planilhaMesa', typeId: 'mesa', ownerEmail: ANA, url: 'https://sheets/ana' },
    },
  };
});

describe('GET /api/consulta/links — o que cada pessoa vê', () => {
  it('pessoais dela + links cujo Público a inclui; Individual com a URL dela', async () => {
    as(ANA);
    const links = await myLinks();
    expect(ids(links)).toEqual(['anaPessoal', 'manualTodos', 'mesaOps', 'planilhaMesa']);
    expect(links.find((l: { id: string }) => l.id === 'planilhaMesa').url).toBe('https://sheets/ana');
    expect(links[0]).not.toHaveProperty('audience');
  });

  it('área, equipe e pessoa específica', async () => {
    as(BRUNO);
    expect(ids(await myLinks())).toEqual(['brunoPessoal', 'comercialArea', 'manualTodos', 'timeSul']);
    as(CARLA);
    expect(ids(await myLinks())).toEqual(['comercialArea', 'manualTodos', 'soCarla']);
  });

  it('Compartilhado por área segue o cadastro: quem entra vê, quem sai deixa de ver', async () => {
    db.collaborators.c3.area = 'Mesa de operações';
    as(CARLA);
    expect(ids(await myLinks())).toEqual(['manualTodos', 'mesaOps', 'soCarla']);

    db.collaborators.c1.area = 'Comercial';
    as(ANA);
    expect(ids(await myLinks())).toEqual(['anaPessoal', 'comercialArea', 'manualTodos', 'planilhaMesa']);
  });

  it('Individual só aparece para quem tem URL cadastrada — nem todo mundo precisa ter', async () => {
    db.collaborators.c3.area = 'Mesa de operações';
    as(CARLA);
    expect(ids(await myLinks())).not.toContain('planilhaMesa');
  });

  it('super admin administra todos os tipos; admin do tipo só o dele', async () => {
    as(SUPER);
    expect((await (await GET(request('/api/consulta/links'))).json()).adminTypeIds).toEqual(['mesa', 'cx']);
    as(MESA_ADMIN);
    expect((await (await GET(request('/api/consulta/links'))).json()).adminTypeIds).toEqual(['mesa']);
  });

  it('admin por área vale pela área atual: quem entra administra, quem sai deixa', async () => {
    as(DIEGO);
    expect((await (await GET(request('/api/consulta/links'))).json()).adminTypeIds).toEqual(['cx']);
    expect((await ADMIN_GET(request('/api/consulta/admin/links?typeId=cx'))).status).toBe(200);

    db.collaborators.c4.area = 'Comercial';
    expect((await (await GET(request('/api/consulta/links'))).json()).adminTypeIds).toEqual([]);
    expect((await ADMIN_GET(request('/api/consulta/admin/links?typeId=cx'))).status).toBe(403);
  });
});

describe('links pessoais', () => {
  it('são sempre de quem cria e recusam URL que não seja http(s)', async () => {
    as(ANA);
    const res = await POST(request('/api/consulta/links', { title: 'Meu', url: 'https://x.com' }));
    expect(db.consultaLinks[(await res.json()).id]).toMatchObject({ kind: 'personal', ownerEmail: ANA, typeId: null });
    expect((await POST(request('/api/consulta/links', { title: 'X', url: 'javascript:alert(1)' }))).status).toBe(400);
    expect((await POST(request('/api/consulta/links', { title: 'X', url: 'https://x.com', ownerEmail: BRUNO }))).status).toBe(400);
  });

  it('só o dono edita/exclui — nem super admin; link de tipo não passa por aqui', async () => {
    as(BRUNO);
    expect((await PATCH(request('/api/consulta/links?id=anaPessoal', { title: 'Hack' }))).status).toBe(403);
    as(SUPER);
    expect((await DELETE(request('/api/consulta/links?id=anaPessoal'))).status).toBe(403);
    expect((await DELETE(request('/api/consulta/links?id=manualTodos'))).status).toBe(403);
    as(ANA);
    expect((await PATCH(request('/api/consulta/links?id=anaPessoal', { title: 'Novo' }))).status).toBe(200);
    expect(db.consultaLinks.anaPessoal.title).toBe('Novo');
  });
});

describe('/api/consulta/admin/links', () => {
  it('admin vê os links do tipo com o Público de cada um; nunca links pessoais', async () => {
    as(MESA_ADMIN);
    const body = await (await ADMIN_GET(request('/api/consulta/admin/links?typeId=mesa'))).json();
    expect(ids(body.links)).toEqual(['comercialArea', 'manualTodos', 'mesaOps', 'planilhaMesa']);
    expect(body.links.find((l: { id: string }) => l.id === 'planilhaMesa').members).toEqual([ANA]);
    expect(body.links.find((l: { id: string }) => l.id === 'comercialArea').members.sort()).toEqual([BRUNO, CARLA]);
    expect(body.values).toHaveLength(1);
  });

  it('quem não administra o tipo é barrado', async () => {
    as(ANA);
    expect((await ADMIN_GET(request('/api/consulta/admin/links?typeId=mesa'))).status).toBe(403);
    as(MESA_ADMIN);
    expect((await ADMIN_GET(request('/api/consulta/admin/links?typeId=cx'))).status).toBe(403);
    expect((await ADMIN_POST(request('/api/consulta/admin/links', {
      typeId: 'cx', kind: 'shared', title: 'X', url: 'https://x.com', audience: audience({ everyone: true }),
    }))).status).toBe(403);
  });

  it('cria Individual (sem URL nem público) e Compartilhado (com URL e público)', async () => {
    as(MESA_ADMIN);
    const individual = await ADMIN_POST(request('/api/consulta/admin/links', { typeId: 'mesa', kind: 'individual', title: 'Carteira' }));
    expect(db.consultaLinks[(await individual.json()).id]).toMatchObject({ kind: 'individual', url: '', ownerEmail: null, audience: null });
    expect((await ADMIN_POST(request('/api/consulta/admin/links', {
      typeId: 'mesa', kind: 'individual', title: 'X', audience: audience({ everyone: true }),
    }))).status).toBe(400);

    expect((await ADMIN_POST(request('/api/consulta/admin/links', {
      typeId: 'mesa', kind: 'shared', title: 'Sem URL', audience: audience({ everyone: true }),
    }))).status).toBe(400);
    expect((await ADMIN_POST(request('/api/consulta/admin/links', {
      typeId: 'mesa', kind: 'shared', title: 'Sem público', url: 'https://x.com', audience: audience({}),
    }))).status).toBe(400);
  });

  it('edita Público do Compartilhado; Individual não tem URL única nem público', async () => {
    as(MESA_ADMIN);
    expect((await ADMIN_PATCH(request('/api/consulta/admin/links?id=comercialArea', { audience: audience({ emails: [ANA] }) }))).status).toBe(200);
    as(BRUNO);
    expect(ids(await myLinks())).not.toContain('comercialArea');
    as(MESA_ADMIN);
    expect((await ADMIN_PATCH(request('/api/consulta/admin/links?id=planilhaMesa', { url: 'https://x.com' }))).status).toBe(400);
    expect((await ADMIN_PATCH(request('/api/consulta/admin/links?id=planilhaMesa', { audience: audience({ everyone: true }) }))).status).toBe(400);
  });

  it('excluir link Individual leva as URLs junto', async () => {
    as(MESA_ADMIN);
    expect((await ADMIN_DELETE(request('/api/consulta/admin/links?id=planilhaMesa'))).status).toBe(200);
    expect(db.consultaLinks.planilhaMesa).toBeUndefined();
    expect(Object.keys(db.consultaLinkValues)).toHaveLength(0);
  });
});

describe('/api/consulta/admin/values', () => {
  it('admin grava e remove a URL de uma pessoa no link Individual', async () => {
    as(MESA_ADMIN);
    expect((await VALUE_PUT(request('/api/consulta/admin/values', { linkId: 'planilhaMesa', ownerEmail: CARLA, url: 'https://sheets/carla' }))).status).toBe(200);
    as(CARLA);
    expect((await myLinks()).find((l: { id: string }) => l.id === 'planilhaMesa').url).toBe('https://sheets/carla');

    as(MESA_ADMIN);
    expect((await VALUE_DELETE(request(`/api/consulta/admin/values?linkId=planilhaMesa&ownerEmail=${CARLA}`))).status).toBe(200);
    expect(db.consultaLinkValues[`planilhaMesa__${CARLA}`]).toBeUndefined();
    as(CARLA);
    expect(ids(await myLinks())).not.toContain('planilhaMesa');
  });

  it('recusa quem não administra, link Compartilhado e colaborador inexistente', async () => {
    as(ANA);
    expect((await VALUE_PUT(request('/api/consulta/admin/values', { linkId: 'planilhaMesa', ownerEmail: ANA, url: 'https://x.com' }))).status).toBe(403);
    as(MESA_ADMIN);
    expect((await VALUE_PUT(request('/api/consulta/admin/values', { linkId: 'manualTodos', ownerEmail: ANA, url: 'https://x.com' }))).status).toBe(400);
    expect((await VALUE_PUT(request('/api/consulta/admin/values', { linkId: 'planilhaMesa', ownerEmail: 'ninguem@venetomfo.com.br', url: 'https://x.com' }))).status).toBe(400);
  });
});

describe('/api/consulta/types', () => {
  it('só super admin cria tipo; nome repetido é recusado', async () => {
    as(MESA_ADMIN);
    expect((await TYPE_POST(request('/api/consulta/types', { name: 'Cliente' }))).status).toBe(403);
    as(SUPER);
    expect((await TYPE_POST(request('/api/consulta/types', { name: 'Cliente', adminEmails: ['A@venetomfo.com.br'] }))).status).toBe(200);
    expect(Object.values(db.consultaLinkTypes).find((t) => t.name === 'Cliente')).toMatchObject({ adminEmails: ['a@venetomfo.com.br'] });
    expect((await TYPE_POST(request('/api/consulta/types', { name: 'mesa' }))).status).toBe(400);
  });

  it('não exclui tipo que ainda tem links', async () => {
    as(SUPER);
    expect((await TYPE_DELETE(request('/api/consulta/types?id=mesa'))).status).toBe(400);
    delete db.consultaLinks.timeSul;
    delete db.consultaLinks.soCarla;
    expect((await TYPE_DELETE(request('/api/consulta/types?id=cx'))).status).toBe(200);
  });
});

describe('typedLinkSchema (formulário do admin)', () => {
  it('aceita o Individual sem público e recusa público no Individual', () => {
    const { typedLinkSchema } = jest.requireActual('@/config/consulta-links');
    expect(typedLinkSchema.safeParse({ kind: 'individual', title: 'Planilha MESA', description: '' }).success).toBe(true);
    expect(typedLinkSchema.safeParse({ kind: 'individual', title: 'X', description: '', audience: audience({ everyone: true }) }).success).toBe(false);
  });

  it('edição do nome de um Individual migrado passa na API', async () => {
    db.consultaLinks.planilhaMesa = { ...db.consultaLinks.planilhaMesa, audience: null };
    as(MESA_ADMIN);
    expect((await ADMIN_PATCH(request('/api/consulta/admin/links?id=planilhaMesa', { title: 'Planilha da Mesa', description: '' }))).status).toBe(200);
    expect(db.consultaLinks.planilhaMesa.title).toBe('Planilha da Mesa');
  });
});
