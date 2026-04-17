import { GET as getBilling } from '@/app/api/billing/route';
import { GET as getCalendar } from '@/app/api/calendar/route';
import { GET as getHolidays } from '@/app/api/holidays/route';
import { GET as getRss } from '@/app/api/rss/route';
import { verifyCorporateRequest } from '@/lib/api-auth';
import { getFirestore } from 'firebase-admin/firestore';
import Parser from 'rss-parser';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      type: 'json',
      status: init?.status || 200,
      body: data,
    })),
  },
}));

jest.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminApp: jest.fn(() => ({})),
}));

const settingsDocGetMock = jest.fn();
const collectionMock = jest.fn(() => ({
  doc: jest.fn(() => ({
    get: settingsDocGetMock,
  })),
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({
    collection: collectionMock,
  })),
}));

jest.mock('@/lib/api-auth', () => ({
  verifyCorporateRequest: jest.fn(),
}));

const parseUrlMock = jest.fn();
const parseStringMock = jest.fn();
jest.mock('rss-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: parseUrlMock,
    parseString: parseStringMock,
  }));
});

const mockedVerifyCorporateRequest = verifyCorporateRequest as jest.MockedFunction<typeof verifyCorporateRequest>;
const mockedGetFirestore = getFirestore as jest.MockedFunction<typeof getFirestore>;
const mockedParser = Parser as unknown as jest.Mock;
const fetchMock = global.fetch as jest.Mock;

function makeRequest(path: string, authorization = 'Bearer token') {
  return {
    url: `https://example.test${path}`,
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'authorization') {
          return authorization || null;
        }
        return null;
      },
    },
  } as unknown as Request;
}

describe('API routes baseline', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };

    mockedVerifyCorporateRequest.mockResolvedValue({
      email: 'user@venetomfo.com.br',
      uid: 'test-uid',
    });

    settingsDocGetMock.mockResolvedValue({
      exists: true,
      data: () => ({
        superAdminEmails: ['admin@venetomfo.com.br'],
      }),
    });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
    });

    parseUrlMock.mockReset();
    parseStringMock.mockReset();
    mockedGetFirestore.mockReturnValue({
      collection: collectionMock,
    } as never);
    mockedParser.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('/api/billing', () => {
    it('retorna 401 quando o token nao e enviado', async () => {
      mockedVerifyCorporateRequest.mockRejectedValueOnce(new Error('UNAUTHORIZED_MISSING_TOKEN'));

      const response = await getBilling(makeRequest('/api/billing'));

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/Token/i);
    });

    it('retorna 403 para usuario sem permissao de super admin', async () => {
      const response = await getBilling(makeRequest('/api/billing'));

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/Super Administrador/i);
    });

    it('retorna dados de faturamento para super admin', async () => {
      mockedVerifyCorporateRequest.mockResolvedValueOnce({
        email: 'admin@venetomfo.com.br',
        uid: 'admin-uid',
      });

      const response = await getBilling(makeRequest('/api/billing'));

      expect(response.status).toBe(200);
      expect(response.body.currentMonth).toBeDefined();
      expect(response.body.services).toHaveLength(5);
    });
  });

  describe('/api/calendar', () => {
    beforeEach(() => {
      process.env.CALENDAR_PUBLIC_ID = 'calendar-id@group.calendar.google.com';
      process.env.GOOGLE_CALENDAR_API_KEY = 'calendar-key';
    });

    it('retorna 401 quando a autenticacao falha', async () => {
      mockedVerifyCorporateRequest.mockRejectedValueOnce(new Error('UNAUTHORIZED_INVALID_TOKEN'));

      const response = await getCalendar(
        makeRequest('/api/calendar?timeMin=2026-01-01T00:00:00.000Z&timeMax=2026-01-31T23:59:59.999Z')
      );

      expect(response.status).toBe(401);
    });

    it('retorna 400 quando faltam parametros obrigatorios', async () => {
      const response = await getCalendar(makeRequest('/api/calendar'));

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/timeMin e timeMax/i);
    });

    it('retorna 503 quando CALENDAR_PUBLIC_ID nao esta configurado', async () => {
      delete process.env.CALENDAR_PUBLIC_ID;

      const response = await getCalendar(
        makeRequest('/api/calendar?timeMin=2026-01-01T00:00:00.000Z&timeMax=2026-01-31T23:59:59.999Z')
      );

      expect(response.status).toBe(503);
      expect(response.body.error).toMatch(/CALENDAR_PUBLIC_ID/i);
    });

    it('retorna itens da agenda quando o upstream responde com sucesso', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 'evt-1', summary: 'Evento 1' }],
        }),
      });

      const response = await getCalendar(
        makeRequest('/api/calendar?timeMin=2026-01-01T00:00:00.000Z&timeMax=2026-01-31T23:59:59.999Z')
      );

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retorna 502 quando a API do Google falha', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () =>
          JSON.stringify({
            error: {
              message: 'Requests from referer are blocked',
            },
          }),
      });

      const response = await getCalendar(
        makeRequest('/api/calendar?timeMin=2026-01-01T00:00:00.000Z&timeMax=2026-01-31T23:59:59.999Z')
      );

      expect(response.status).toBe(502);
      expect(response.body.error).toMatch(/agenda/i);
      expect(response.body.hint).toBeDefined();
    });
  });

  describe('/api/holidays', () => {
    it('retorna 401 quando a autenticacao falha', async () => {
      mockedVerifyCorporateRequest.mockRejectedValueOnce(new Error('UNAUTHORIZED_MISSING_TOKEN'));

      const response = await getHolidays(makeRequest('/api/holidays?year=2026'));

      expect(response.status).toBe(401);
    });

    it('retorna 400 para year invalido', async () => {
      const response = await getHolidays(makeRequest('/api/holidays?year=1800'));

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/year invalido/i);
    });

    it('normaliza a resposta da BrasilAPI', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ([
          { date: '2026-01-01', name: 'Confraternizacao Universal', type: 'nacional' },
        ]),
      });

      const response = await getHolidays(makeRequest('/api/holidays?year=2026'));

      expect(response.status).toBe(200);
      expect(response.body.holidays).toEqual([
        {
          dateISO: '2026-01-01',
          name: 'Confraternizacao Universal',
          type: 'nacional',
        },
      ]);
    });

    it('retorna lista vazia quando o upstream devolve 404', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const response = await getHolidays(makeRequest('/api/holidays?year=2026'));

      expect(response.status).toBe(200);
      expect(response.body.holidays).toEqual([]);
    });

    it('retorna 500 quando o upstream falha com erro generico', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const response = await getHolidays(makeRequest('/api/holidays?year=2026'));

      expect(response.status).toBe(500);
      expect(response.body.error).toMatch(/feriados/i);
    });
  });

  describe('/api/rss', () => {
    it('retorna 400 quando nenhuma URL e enviada', async () => {
      const response = await getRss(makeRequest('/api/rss'));

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Nenhuma URL/i);
    });

    it('retorna 400 quando a quantidade de feeds excede o limite', async () => {
      const urls = Array.from({ length: 6 }, (_, index) => `https://www.infomoney.com.br/feed-${index}`);
      const response = await getRss(
        makeRequest(`/api/rss?urls=${encodeURIComponent(urls.join(','))}`)
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/entre 1 e 5/i);
    });

    it('retorna 403 quando a URL nao esta na allowlist', async () => {
      const response = await getRss(
        makeRequest(`/api/rss?urls=${encodeURIComponent('https://malicious.example/feed')}`)
      );

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/nao permitida/i);
    });

    it('retorna feeds combinados e ordenados para hosts permitidos', async () => {
      const makeUpstreamResponse = (body: string) => ({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => {
            const lower = name.toLowerCase();
            if (lower === 'content-type') return 'application/rss+xml';
            if (lower === 'content-length') return String(body.length);
            return null;
          },
        },
        text: async () => body,
      });

      fetchMock
        .mockResolvedValueOnce(makeUpstreamResponse('<rss>mercados</rss>'))
        .mockResolvedValueOnce(makeUpstreamResponse('<rss>economia</rss>'));

      parseStringMock
        .mockResolvedValueOnce({
          title: 'Feed Mercados',
          items: [
            { title: 'Mais antigo', isoDate: '2026-01-01T09:00:00.000Z', content: 'a' },
          ],
        })
        .mockResolvedValueOnce({
          title: 'Feed Economia',
          items: [
            { title: 'Mais recente', isoDate: '2026-01-02T09:00:00.000Z', content: 'b' },
          ],
        });

      const urls = [
        'https://www.infomoney.com.br/mercados/feed',
        'https://www.infomoney.com.br/economia/feed',
      ];

      const response = await getRss(
        makeRequest(`/api/rss?urls=${encodeURIComponent(urls.join(','))}`)
      );

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Feed Mercados');
      expect(response.body.items).toHaveLength(2);
      expect(response.body.items[0].title).toBe('Mais recente');
      expect(parseStringMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retorna 502 quando upstream responde com status de erro', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: { get: () => null },
        text: async () => '',
      });

      const response = await getRss(
        makeRequest(
          `/api/rss?urls=${encodeURIComponent('https://www.infomoney.com.br/mercados/feed')}`
        )
      );

      expect(response.status).toBe(502);
      expect(response.body.error).toMatch(/feeds/i);
      expect(parseStringMock).not.toHaveBeenCalled();
    });

    it('retorna 502 quando upstream excede limite de body', async () => {
      const huge = 'x'.repeat(3 * 1024 * 1024); // 3MB > 2MB
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'content-length' ? String(huge.length) : 'application/rss+xml',
        },
        text: async () => huge,
      });

      const response = await getRss(
        makeRequest(
          `/api/rss?urls=${encodeURIComponent('https://www.infomoney.com.br/mercados/feed')}`
        )
      );

      expect(response.status).toBe(502);
      expect(parseStringMock).not.toHaveBeenCalled();
    });
  });
});
