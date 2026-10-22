import { buildPeople, groupAssistants, isBirthdayOn, managerChain, normalizeCity, overlapsRange, teamsOf, topLeaders } from '@/lib/hub/people';

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
    expect(managerChain(people, 'dan').map((p) => p.id)).toEqual(['bia', 'ana']);
  });

  it('sócios cadastrados um como gestor do outro viram o topo, e a cadeia para neles', () => {
    const socios = buildPeople([
      c({ id: 'cp', idVeneto: '10', name: 'Carlos', leaderIdVeneto: '11' }),
      c({ id: 'fd', idVeneto: '11', name: 'Fernando', leaderIdVeneto: '10' }),
      c({ id: 'pr', idVeneto: '12', name: 'Paulo', leaderIdVeneto: '11' }),
      c({ id: 'zé', idVeneto: '13', name: 'Zé', leaderIdVeneto: '12' }),
    ]);
    expect(topLeaders(socios).map((p) => p.id)).toEqual(['cp', 'fd']);
    expect(managerChain(socios, 'zé').map((p) => p.id)).toEqual(['pr', 'fd']);
    expect(managerChain(socios, 'cp')).toEqual([]);
  });

  it('assistente fica logo abaixo do comercial que ele atende', () => {
    const team = buildPeople([
      c({ id: 'ana', idVeneto: '30', name: 'Ana Bacha', managerOverrideIdVeneto: '32' }),
      c({ id: 'bruno', idVeneto: '31', name: 'Bruno Ottoni', leaderIdVeneto: '99' }),
      c({ id: 'lucas', idVeneto: '32', name: 'Lucas Freitas', leaderIdVeneto: '99' }),
      c({ id: 'gabi', idVeneto: '33', name: 'Gabriel Portela', managerOverrideIdVeneto: '34' }),
      c({ id: 'gus', idVeneto: '34', name: 'Gustavo Oliveira', leaderIdVeneto: '99' }),
    ]);
    const groups = groupAssistants(team);
    expect(groups.map((g) => [g.person.id, g.assistants.map((a) => a.id)])).toEqual([
      ['bruno', []],
      ['lucas', ['ana']],
      ['gus', ['gabi']],
    ]);
  });

  it('quem está oculto no Hub não aparece nem serve de gestor', () => {
    const list = buildPeople([
      c({ id: 'ok', idVeneto: '20', name: 'Ok', leaderIdVeneto: '21' }),
      c({ id: 'teste', idVeneto: '21', name: 'ti', hubHidden: true }),
    ]);
    expect(list.map((p) => p.id)).toEqual(['ok']);
    expect(list[0].managerId).toBeNull();
  });

  it('datas: aniversário pelo dia/mês local, cidade sem UF, período que cruza a janela', () => {
    expect(isBirthdayOn('1990-10-19', new Date(2026, 9, 19, 8))).toBe(true);
    expect(isBirthdayOn('1990-10-20', new Date(2026, 9, 19, 23))).toBe(false);
    expect(normalizeCity('São Paulo - SP')).toBe('sao paulo');
    expect(overlapsRange('2026-10-18', '2026-10-19', new Date(2026, 9, 19, 15), new Date(2026, 9, 30))).toBe(true);
    expect(overlapsRange('2026-10-01', '2026-10-02', new Date(2026, 9, 19), new Date(2026, 9, 30))).toBe(false);
  });
});
