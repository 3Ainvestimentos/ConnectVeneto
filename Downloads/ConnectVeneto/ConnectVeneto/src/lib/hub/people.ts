/**
 * Pessoas do Hub a partir do cadastro de colaboradores (`collaborators`). Regras puras: montar o
 * Perfil, resolver o Gestor e as Equipes, e as datas que o Hub usa (aniversário, viagens, férias).
 *
 * Gestor (ADR 0001): `leaderIdVeneto` aponta para o `idVeneto` do gestor. Enquanto a migração não
 * cobre todo mundo, cai para o nome em `leader` (como na planilha do RH), só se o nome for único.
 */

export interface CareerStep {
  position: string;
  period: string;
}

/** Campos do cadastro que o Hub lê (subconjunto de `Collaborator`). */
export interface CollaboratorLike {
  id: string;
  idVeneto?: string;
  name: string;
  email: string;
  photoURL?: string;
  axis?: string;
  area?: string;
  position?: string;
  city?: string;
  leader?: string;
  leaderIdVeneto?: string;
  team?: string;
  birthDate?: string;
  admissionDate?: string;
  careerHistory?: CareerStep[];
  bio?: string;
  responsibilities?: string[];
  interests?: string[];
  phone?: string;
  googleChat?: string;
  authUid?: string;
}

export interface HubPerson {
  id: string;
  idVeneto: string;
  name: string;
  email: string;
  photoURL?: string;
  authUid?: string;
  position: string;
  area: string;
  axis: string;
  city: string;
  team?: string;
  /** `id` do gestor no Hub (null = sem gestor encontrado). */
  managerId: string | null;
  /** Como o gestor foi encontrado: pelo ID (ADR 0001) ou, provisoriamente, pelo nome. */
  managerMatch: 'id' | 'name' | null;
  birthDate?: string;
  since?: string;
  history: CareerStep[];
  bio?: string;
  responsibilities: string[];
  interests: string[];
  phone?: string;
  chat?: string;
}

/** Nome comparável: sem acento, minúsculo, espaços simples. */
export function normalizeName(name: string | undefined | null): string {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** "Belo Horizonte - MG" → "belo horizonte"; "São Paulo" → "sao paulo". */
export function normalizeCity(city: string | undefined | null): string {
  return normalizeName((city ?? '').split(' - ')[0]);
}

const blankToUndef = (v?: string) => (v && v.trim() && v.trim() !== '—' ? v.trim() : undefined);

export function buildPeople(collaborators: CollaboratorLike[]): HubPerson[] {
  const byIdVeneto = new Map<string, CollaboratorLike>();
  const byName = new Map<string, CollaboratorLike[]>();
  for (const c of collaborators) {
    if (c.idVeneto) byIdVeneto.set(c.idVeneto.trim(), c);
    const key = normalizeName(c.name);
    byName.set(key, [...(byName.get(key) ?? []), c]);
  }

  return collaborators.map((c) => {
    let manager: CollaboratorLike | undefined;
    let managerMatch: HubPerson['managerMatch'] = null;
    if (c.leaderIdVeneto && byIdVeneto.has(c.leaderIdVeneto.trim())) {
      manager = byIdVeneto.get(c.leaderIdVeneto.trim());
      managerMatch = 'id';
    } else {
      const sameName = byName.get(normalizeName(c.leader));
      if (sameName?.length === 1) {
        manager = sameName[0];
        managerMatch = 'name';
      }
    }
    if (manager?.id === c.id) {
      manager = undefined;
      managerMatch = null;
    }
    return {
      id: c.id,
      idVeneto: c.idVeneto ?? '',
      name: c.name,
      email: c.email,
      photoURL: blankToUndef(c.photoURL),
      authUid: c.authUid,
      position: c.position ?? '',
      area: c.area ?? '',
      axis: c.axis ?? '',
      city: c.city ?? '',
      team: blankToUndef(c.team),
      managerId: manager?.id ?? null,
      managerMatch,
      birthDate: blankToUndef(c.birthDate),
      since: blankToUndef(c.admissionDate),
      history: c.careerHistory ?? [],
      bio: blankToUndef(c.bio),
      responsibilities: c.responsibilities ?? [],
      interests: c.interests ?? [],
      phone: blankToUndef(c.phone),
      chat: blankToUndef(c.googleChat),
    };
  });
}

export function directReports(people: HubPerson[], managerId: string): HubPerson[] {
  return people.filter((p) => p.managerId === managerId).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** Liderados diretos agrupados por Equipe (quem não tem equipe vai para "Sem equipe"). */
export function teamsOf(people: HubPerson[], managerId: string): { team: string; members: HubPerson[] }[] {
  const groups = new Map<string, HubPerson[]>();
  for (const p of directReports(people, managerId)) {
    const team = p.team ?? 'Sem equipe';
    groups.set(team, [...(groups.get(team) ?? []), p]);
  }
  return [...groups.entries()].map(([team, members]) => ({ team, members })).sort((a, b) => a.team.localeCompare(b.team, 'pt-BR'));
}

/** Topo do organograma: quem não tem gestor encontrado e lidera alguém. */
export function topLeaders(people: HubPerson[]): HubPerson[] {
  const leads = new Set(people.map((p) => p.managerId).filter(Boolean));
  return people.filter((p) => p.managerId === null && leads.has(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** "AAAA-MM-DD" como data local (meio-dia), sem virar o dia pelo fuso. Aceita ISO completo também. */
export function parseLocalDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Aniversário neste dia (compara dia e mês, no fuso local). */
export function isBirthdayOn(birthDate: string | undefined, day = new Date()): boolean {
  const d = parseLocalDate(birthDate);
  return !!d && d.getDate() === day.getDate() && d.getMonth() === day.getMonth();
}

/** Períodos de datas ("AAAA-MM-DD") que se cruzam com [from, to]. */
export function overlapsRange(start: string, end: string, from: Date, to: Date): boolean {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  if (!s || !e) return false;
  const endOfDay = new Date(e);
  endOfDay.setHours(23, 59, 59, 999);
  const startOfDay = new Date(s);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay <= to && endOfDay >= from;
}
