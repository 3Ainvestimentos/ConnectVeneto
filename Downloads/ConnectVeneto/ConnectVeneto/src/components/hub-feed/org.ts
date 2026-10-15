import type { Person } from '@/lib/hub-mock/types';

export const directReports = (people: Person[], managerId: string) => people.filter((p) => p.managerId === managerId);

/** Reportes diretos agrupados por Equipe — um Gestor pode liderar várias. */
export function teamsOf(people: Person[], managerId: string): { team: string; members: Person[] }[] {
  const groups = new Map<string, Person[]>();
  for (const p of directReports(people, managerId)) {
    const team = p.team ?? 'Sem equipe';
    groups.set(team, [...(groups.get(team) ?? []), p]);
  }
  return [...groups.entries()].map(([team, members]) => ({ team, members }));
}
