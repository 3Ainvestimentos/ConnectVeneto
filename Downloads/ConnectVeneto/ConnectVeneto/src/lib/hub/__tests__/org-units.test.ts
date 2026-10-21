import { canBeChildOf, isSameOrDescendant, managerFromStructure, unitPathLabel, type OrgUnit } from '@/lib/hub/org-units';
import { buildPeople } from '@/lib/hub/people';

const units: OrgUnit[] = [
  { id: 'dir', name: 'Diretoria de Operações', type: 'diretoria', parentId: null, leaderIdVeneto: 'CEO1' },
  { id: 'areaB', name: 'Área B', type: 'area', parentId: 'dir', leaderIdVeneto: 'TMD5' },
  { id: 'eqA', name: 'Equipe A', type: 'equipe', parentId: 'areaB', leaderIdVeneto: null },
  { id: 'eqC', name: 'Equipe C', type: 'equipe', parentId: 'areaB', leaderIdVeneto: 'LIDC' },
];
const map = new Map(units.map((u) => [u.id, u]));

describe('hub/org-units', () => {
  it('gestor pela estrutura: responsável da unidade; se for a própria pessoa, sobe para a mãe', () => {
    expect(managerFromStructure(map, 'eqA', 'X1')).toBe('TMD5'); // equipe sem responsável → área
    expect(managerFromStructure(map, 'eqC', 'X2')).toBe('LIDC');
    expect(managerFromStructure(map, 'eqC', 'LIDC')).toBe('TMD5'); // responsável da equipe → da área
    expect(managerFromStructure(map, 'areaB', 'TMD5')).toBe('CEO1');
    expect(managerFromStructure(map, 'dir', 'CEO1')).toBeNull();
  });

  it('hierarquia: tipos permitidos, ciclos e caminho', () => {
    expect(canBeChildOf('equipe', null)).toBe(false);
    expect(canBeChildOf('area', 'diretoria')).toBe(true);
    expect(canBeChildOf('diretoria', 'area')).toBe(false);
    expect(isSameOrDescendant(map, 'eqA', 'dir')).toBe(true);
    expect(isSameOrDescendant(map, 'dir', 'eqA')).toBe(false);
    expect(unitPathLabel(map, 'eqA')).toBe('Diretoria de Operações › Área B › Equipe A');
  });

  it('buildPeople: exceção manual > estrutura > ID legado; equipe vem da unidade', () => {
    const people = buildPeople(
      [
        { id: 't', idVeneto: 'TMD5', name: 'Tairine', email: 't@v', unitId: 'areaB' },
        { id: 'ceo', idVeneto: 'CEO1', name: 'CEO', email: 'c@v', unitId: 'dir' },
        { id: 'a', idVeneto: 'A1', name: 'Ana', email: 'a@v', unitId: 'eqA', leaderIdVeneto: 'CEO1' },
        { id: 'b', idVeneto: 'B1', name: 'Bia', email: 'b@v', unitId: 'eqA', managerOverrideIdVeneto: 'CEO1' },
        { id: 'z', idVeneto: 'Z1', name: 'Zé', email: 'z@v', leaderIdVeneto: 'TMD5', team: 'Texto livre' },
      ],
      units,
    );
    const by = Object.fromEntries(people.map((p) => [p.id, p]));
    expect(by.a).toMatchObject({ managerId: 't', managerMatch: 'structure', team: 'Equipe A', unitId: 'eqA' });
    expect(by.b).toMatchObject({ managerId: 'ceo', managerMatch: 'override' });
    expect(by.t).toMatchObject({ managerId: 'ceo', managerMatch: 'structure', team: undefined });
    expect(by.z).toMatchObject({ managerId: 't', managerMatch: 'id', team: 'Texto livre', unitId: undefined });
  });
});
