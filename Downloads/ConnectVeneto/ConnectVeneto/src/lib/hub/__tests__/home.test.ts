import { activeAvisos, countNewSince, followedNews } from '@/lib/hub/home';

const NOW = Date.parse('2026-10-18T12:00:00Z');
const base = { reactionCounts: {}, commentCount: 0, authorEmail: 'outra@venetomfo.com.br' };
const post = (over: Record<string, unknown>) => ({
  id: 'x',
  channelId: 'institucional',
  importance: 'normal' as const,
  createdAt: '2026-10-17T10:00:00Z',
  ...base,
  ...over,
});

describe('hub/home', () => {
  beforeAll(() => jest.useFakeTimers().setSystemTime(NOW));
  afterAll(() => jest.useRealTimers());

  it('followedNews: só Normais de canais seguidos e de outras pessoas, mais recentes primeiro', () => {
    const posts = [
      post({ id: 'a', createdAt: '2026-10-15T10:00:00Z' }),
      post({ id: 'b', createdAt: '2026-10-17T10:00:00Z' }),
      post({ id: 'aviso', importance: 'importante', highlightUntil: '2026-10-30T00:00:00Z' }),
      post({ id: 'outro-canal', channelId: 'mercado' }),
      post({ id: 'minha', authorEmail: 'eu@venetomfo.com.br' }),
      post({ id: 'expirada', expiresAt: '2026-10-01T00:00:00Z' }),
    ];
    expect(followedNews(posts, ['institucional'], 'eu@venetomfo.com.br').map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('countNewSince: conta só o que chegou depois do último Resumo; sem histórico, zero', () => {
    const posts = [post({ id: 'velha', createdAt: '2026-10-10T00:00:00Z' }), post({ id: 'nova', createdAt: '2026-10-17T00:00:00Z' })];
    expect(countNewSince(posts, ['institucional'], '2026-10-12T00:00:00Z', 'eu@x')).toBe(1);
    expect(countNewSince(posts, ['institucional'], null, 'eu@x')).toBe(0);
  });

  it('activeAvisos: Importantes dentro do prazo, ordenados pelo vencimento (evento ou prazo)', () => {
    const posts = [
      post({ id: 'declaracao', importance: 'importante', highlightUntil: '2026-10-31T23:59:00Z' }),
      post({ id: 'kickoff', importance: 'importante', highlightUntil: '2026-11-05T23:59:00Z', event: { start: '2026-10-25T12:00:00Z' } }),
      post({ id: 'encerrado', importance: 'importante', highlightUntil: null }),
      post({ id: 'vencido', importance: 'importante', highlightUntil: '2026-10-14T00:00:00Z' }),
      post({ id: 'noticia' }),
    ];
    expect(activeAvisos(posts, NOW).map((p) => p.id)).toEqual(['kickoff', 'declaracao']);
  });
});
