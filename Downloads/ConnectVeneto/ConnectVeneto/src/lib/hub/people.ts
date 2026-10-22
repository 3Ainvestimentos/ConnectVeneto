/**
 * Pessoas do Hub a partir do cadastro de colaboradores (`collaborators`). Regras puras: montar o
 * Perfil, resolver o Gestor e as Equipes, e as datas que o Hub usa (aniversário, viagens, férias).
 *
 * Gestor, nesta ordem: exceção manual (`managerOverrideIdVeneto`); estrutura (ADR 0004: responsável
 * da unidade da pessoa ou, se for ela, da unidade-mãe); `leaderIdVeneto` (ADR 0001, legado); e por
 * fim o nome em `leader` (planilha do RH), só se o nome for único.
 */
import { managerFromStructure, unitChain, type OrgUnit } from './org-units';

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
  /** Unidade da estrutura (ADR 0004), normalmente uma Equipe. */
  unitId?: string;
  /** Gestor fora da regra da estrutura (exceção manual), pelo idVeneto. */
  managerOverrideIdVeneto?: string;
  /** Fora do Hub (contas de teste, quem saiu): não entra em nenhuma lista nem resolve gestor. */
  hubHidden?: boolean;
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
  /** Unidade da estrutura (ou undefined, se ainda não encaixada). */
  unitId?: string;
  /** `id` do gestor no Hub (null = sem gestor encontrado). */
  managerId: string | null;
  /** Como o gestor foi encontrado: exceção manual, estrutura, ID legado ou nome. */
  managerMatch: 'override' | 'structure' | 'id' | 'name' | null;
  birthDate?: string;
  since?: string;
  history: CareerStep[];
  bio?: string;
  responsibilities: string[];
  interests: string[];
  phone?: string;
  chat?: string;
}

/** Férias aprovadas como a API `/api/feed/vacations` devolve. */
export interface HubVacationItem {
  id: string;
  /** Firebase uid de quem sai de férias (casa com `collaborators.authUid`). */
  uid: string;
  name: string;
  startDate: string;
  endDate: string;
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

export function buildPeople(allCollaborators: CollaboratorLike[], orgUnits: OrgUnit[] = []): HubPerson[] {
  const collaborators = allCollaborators.filter((c) => !c.hubHidden);
  const units = new Map(orgUnits.map((u) => [u.id, u]));
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
    const unitId = c.unitId && units.has(c.unitId) ? c.unitId : undefined;
    const fromStructure = unitId ? managerFromStructure(units, unitId, (c.idVeneto ?? '').trim()) : null;
    if (c.managerOverrideIdVeneto && byIdVeneto.has(c.managerOverrideIdVeneto.trim())) {
      manager = byIdVeneto.get(c.managerOverrideIdVeneto.trim());
      managerMatch = 'override';
    } else if (fromStructure && byIdVeneto.has(fromStructure)) {
      manager = byIdVeneto.get(fromStructure);
      managerMatch = 'structure';
    } else if (c.leaderIdVeneto && byIdVeneto.has(c.leaderIdVeneto.trim())) {
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
      // Na estrutura, a equipe é a unidade do tipo Equipe da cadeia; sem estrutura, o texto do cadastro.
      team: unitChain(units, unitId).find((u) => u.type === 'equipe')?.name ?? blankToUndef(c.team),
      unitId,
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

export interface MemberGroup {
  person: HubPerson;
  /** Quem reporta a esta pessoa dentro da mesma lista (ex.: assistente de um comercial). */
  assistants: HubPerson[];
}

/**
 * Lista de uma unidade com cada assistente logo abaixo de quem ele atende: quem tem como gestor
 * outra pessoa da mesma lista vai para o grupo dela. A ordem dos grupos segue a lista recebida.
 */
export function groupAssistants(members: HubPerson[]): MemberGroup[] {
  const ids = new Set(members.map((m) => m.id));
  const isAssistant = (m: HubPerson) => !!m.managerId && m.managerId !== m.id && ids.has(m.managerId);
  const groups = new Map<string, MemberGroup>();
  for (const m of members) if (!isAssistant(m)) groups.set(m.id, { person: m, assistants: [] });
  for (const m of members) {
    if (!isAssistant(m)) continue;
    const boss = groups.get(m.managerId!);
    // Gestor que também é assistente de alguém (cadeia): fica como grupo próprio.
    if (boss) boss.assistants.push(m);
    else groups.set(m.id, { person: m, assistants: [] });
  }
  return [...groups.values()];
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

/**
 * Topo do organograma: quem não tem gestor encontrado e lidera alguém. Gestão em ciclo (A reporta a B
 * e B a A, como sócios cadastrados um como gestor do outro) também vira topo; senão a árvore fica sem raiz.
 */
export function topLeaders(people: HubPerson[]): HubPerson[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const leads = new Set(people.map((p) => p.managerId).filter(Boolean));
  const tops = new Set<string>();
  for (const p of people) {
    if (p.managerId === null) {
      if (leads.has(p.id)) tops.add(p.id);
      continue;
    }
    const path: string[] = [];
    let current: string | null = p.id;
    while (current && !path.includes(current)) {
      path.push(current);
      current = byId.get(current)?.managerId ?? null;
    }
    if (current) for (const id of path.slice(path.indexOf(current))) tops.add(id);
  }
  return people.filter((p) => tops.has(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** Gestores acima da pessoa, do mais próximo ao topo. Para no topo do organograma e em ciclos. */
export function managerChain(people: HubPerson[], personId: string, tops: Set<string> = new Set(topLeaders(people).map((p) => p.id))): HubPerson[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const chain: HubPerson[] = [];
  let current = byId.get(personId);
  while (current && !tops.has(current.id) && current.managerId) {
    const manager = byId.get(current.managerId);
    if (!manager || manager.id === personId || chain.includes(manager)) break;
    chain.push(manager);
    current = manager;
  }
  return chain;
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
