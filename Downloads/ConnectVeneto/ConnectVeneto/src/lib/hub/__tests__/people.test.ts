import { buildPeople, isBirthdayOn, normalizeCity, overlapsRange, teamsOf, topLeaders } from '@/lib/hub/people';

const c = (over: Record<string, unknown>) => ({ id: 'x', name: 'X', email: 'x@v.com', ...over });

describe('hub/people', () => {
  const people = buildPeople([
    c({ id: 'ana', idVeneto: '1', name: 'Ana Daldegan', leader: '—' }),
    c({ id: 'bia', idVeneto: '2', name: 'Bia Souza', leaderIdVeneto: '1', team: 'Comercial SP' }),
    c({ id: 'caio', idVeneto: '3', name: 'Caio Lima', leader: 'ana daldegan', team: 'Comercial SP' }),
    c({ id: 'dan', idVeneto: '4', name: 'Dan Reis', leader: 'Bia Souza' }),
    c({ id: 'eva', idVeneto: '5', name: 'Eva', leader: 'Nome Que Não Existe' }),
  ]);
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));

  it('resolve o gestor pelo ID e, sem ID, pelo nome (sem acento/caixa)', () => {
    expect(byId.bia.managerId).toBe('ana');
    expect(byId.bia.managerMatch).toBe('id');
    expect(byId.caio.managerId).toBe('ana');
    expect(byId.caio.managerMatch).toBe('name');
    expect(byId.eva.managerId).toBeNull();
    expect(byId.ana.managerId).toBeNull();
  });

  it('agrupa liderados por equipe e acha o topo do organograma', () => {
    expect(teamsOf(people, 'ana')).toEqual([{ team: 'Comercial SP', members: [byId.bia, byId.caio] }]);
    expect(teamsOf(people, 'bia')[0].team).toBe('Sem equipe');
    expect(topLeaders(people).map((p) => p.id)).toEqual(['ana']);
  });

  it('datas: aniversário pelo dia/mês local, cidade sem UF, período que cruza a janela', () => {
    expect(isBirthdayOn('1990-10-19', new Date(2026, 9, 19, 8))).toBe(true);
    expect(isBirthdayOn('1990-10-20', new Date(2026, 9, 19, 23))).toBe(false);
    expect(normalizeCity('São Paulo - SP')).toBe('sao paulo');
    expect(overlapsRange('2026-10-18', '2026-10-19', new Date(2026, 9, 19, 15), new Date(2026, 9, 30))).toBe(true);
    expect(overlapsRange('2026-10-01', '2026-10-02', new Date(2026, 9, 19), new Date(2026, 9, 30))).toBe(false);
  });
});
