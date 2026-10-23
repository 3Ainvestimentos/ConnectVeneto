import { computeOrgDerivedUpdates, deriveOrgFields } from '@/lib/hub/org-derived';
import type { OrgUnit } from '@/lib/hub/org-units';

const units: OrgUnit[] = [
  { id: 'dir', name: 'Diretoria de Operações', type: 'diretoria', parentId: null, leaderIdVeneto: 'CEO1' },
  { id: 'areaB', name: 'Operações', type: 'area', parentId: 'dir', leaderIdVeneto: 'TMD5' },
  { id: 'eqA', name: 'Mesa de Operações', type: 'equipe', parentId: 'areaB', leaderIdVeneto: null },
  { id: 'soloDir', name: 'Diretoria Solo', type: 'diretoria', parentId: null, leaderIdVeneto: null },
  { id: 'eqDir', name: 'Equipe da Diretoria', type: 'equipe', parentId: 'soloDir', leaderIdVeneto: null },
];

const collaborators = [
  { id: 'ceo', idVeneto: 'CEO1', name: 'CEO', email: 'c@v', unitId: 'dir', area: 'Diretoria', leader: '—' },
  { id: 't', idVeneto: 'TMD5', name: 'Tairine', email: 't@v', unitId: 'areaB', area: 'Operações', team: 'Antiga', leader: 'CEO' },
  { id: 'a', idVeneto: 'A1', name: 'Ana', email: 'a@v', unitId: 'eqA', area: 'Ops', team: 'Mesa de Operações', leader: 'Fulano' },
  { id: 'b', idVeneto: 'B1', name: 'Bia', email: 'b@v', unitId: 'eqA', managerOverrideIdVeneto: 'CEO1', area: 'Operações', team: 'Mesa de Operações', leader: 'CEO' },
  { id: 's', idVeneto: 'S1', name: 'Solo', email: 's@v', unitId: 'eqDir', leader: 'Manual' },
  { id: 'z', idVeneto: 'Z1', name: 'Zé', email: 'z@v', area: 'Livre', team: 'Texto', leader: 'Tairine' },
  { id: 'x', idVeneto: 'X1', name: 'Sumiu', email: 'x@v', unitId: 'apagada', area: 'Velha' },
];

describe('hub/org-derived', () => {
  it('área = Área mais próxima (senão Diretoria); equipe = Equipe da cadeia ou vazio; líder = gestor resolvido', () => {
    const d = deriveOrgFields(collaborators, units);
    expect(d.get('a')).toEqual({ area: 'Operações', team: 'Mesa de Operações', leader: 'Tairine' });
    expect(d.get('t')).toEqual({ area: 'Operações', team: '', leader: 'CEO' });
    expect(d.get('ceo')).toEqual({ area: 'Diretoria de Operações', team: '' }); // sem gestor: líder não muda
    expect(d.get('b')).toMatchObject({ leader: 'CEO' }); // exceção manual vale
    expect(d.get('s')).toEqual({ area: 'Diretoria Solo', team: 'Equipe da Diretoria' });
    expect(d.has('z')).toBe(false); // sem unidade: não mexe
    expect(d.has('x')).toBe(false); // unidade que não existe mais: não mexe
  });

  it('só devolve o que muda, com o valor antigo, e respeita `only`', () => {
    const updates = computeOrgDerivedUpdates(collaborators, units);
    const by = Object.fromEntries(updates.map((u) => [u.id, u.changes]));
    expect(by.a).toEqual([
      { field: 'area', oldValue: 'Ops', newValue: 'Operações' },
      { field: 'leader', oldValue: 'Fulano', newValue: 'Tairine' },
    ]);
    expect(by.t).toEqual([{ field: 'team', oldValue: 'Antiga', newValue: '' }]);
    expect(by.s).toEqual([
      { field: 'area', oldValue: null, newValue: 'Diretoria Solo' },
      { field: 'team', oldValue: null, newValue: 'Equipe da Diretoria' },
    ]);
    expect(by.b).toBeUndefined();
    expect(by.z).toBeUndefined();
    expect(computeOrgDerivedUpdates(collaborators, units, ['a']).map((u) => u.id)).toEqual(['a']);
  });
});
