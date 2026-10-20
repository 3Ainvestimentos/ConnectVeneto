import { getFirestore, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { isSuperAdminAddress, type AuthenticatedRequestContext } from '@/lib/security';
import {
  CONSULTA_LINK_TYPES_COLLECTION,
  isTypeAdmin,
  type Audience,
  type AudienceMember,
  type ConsultaLink,
  type ConsultaLinkType,
  type ConsultaLinkValue,
  type LinkKind,
} from '@/config/consulta-links';

export type ConsultaAccess = {
  email: string;
  /** Cadastro atual (área e equipe) — decide admin por área e o Público dos links. */
  member: AudienceMember;
  isSuperAdmin: boolean;
  types: ConsultaLinkType[];
  /** Tipos que a pessoa administra — todos, para super admin. */
  adminTypeIds: string[];
};

const stringList = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

export const toLinkType = (id: string, data: DocumentData): ConsultaLinkType => ({
  id,
  name: String(data.name ?? ''),
  description: String(data.description ?? ''),
  adminEmails: stringList(data.adminEmails),
  adminAreas: stringList(data.adminAreas),
  order: typeof data.order === 'number' ? data.order : 0,
});

const toAudience = (data: unknown): Audience | null => {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;
  return {
    everyone: raw.everyone === true,
    areas: stringList(raw.areas),
    teams: stringList(raw.teams),
    emails: stringList(raw.emails),
  };
};

const KINDS: LinkKind[] = ['personal', 'individual', 'shared'];

export const toLink = (id: string, data: DocumentData): ConsultaLink => ({
  id,
  kind: KINDS.includes(data.kind) ? data.kind : 'personal',
  typeId: typeof data.typeId === 'string' ? data.typeId : null,
  ownerEmail: typeof data.ownerEmail === 'string' ? data.ownerEmail : null,
  title: String(data.title ?? ''),
  url: String(data.url ?? ''),
  description: String(data.description ?? ''),
  audience: toAudience(data.audience),
  createdByEmail: String(data.createdByEmail ?? ''),
  createdAt: String(data.createdAt ?? ''),
  updatedAt: String(data.updatedAt ?? ''),
  updatedByEmail: String(data.updatedByEmail ?? ''),
});

export const toLinkValue = (id: string, data: DocumentData): ConsultaLinkValue => ({
  id,
  linkId: String(data.linkId ?? ''),
  typeId: String(data.typeId ?? ''),
  ownerEmail: String(data.ownerEmail ?? ''),
  url: String(data.url ?? ''),
  updatedAt: String(data.updatedAt ?? ''),
  updatedByEmail: String(data.updatedByEmail ?? ''),
});

export const consultaDb = (): Firestore => getFirestore(getFirebaseAdminApp());

const byOrderThenName = (a: ConsultaLinkType, b: ConsultaLinkType) =>
  a.order - b.order || a.name.localeCompare(b.name, 'pt-BR');

/**
 * Quem é a pessoa para a Consulta Pessoal: os tipos existentes e quais ela
 * administra. Os admins (e-mails e áreas) moram no próprio documento do tipo — o
 * super admin edita na tela, sem passar pelo cadastro do colaborador. Admin por área
 * vale pela área atual: quem entra na área passa a administrar, quem sai deixa.
 */
export async function resolveConsultaAccess(
  context: AuthenticatedRequestContext
): Promise<ConsultaAccess> {
  if (!context.email) throw new Error('UNAUTHORIZED_INVALID_TOKEN');

  const [isSuperAdmin, typesSnapshot, member] = await Promise.all([
    isSuperAdminAddress(context.email),
    consultaDb().collection(CONSULTA_LINK_TYPES_COLLECTION).get(),
    loadMember(context.email),
  ]);

  const types = typesSnapshot.docs.map((doc) => toLinkType(doc.id, doc.data())).sort(byOrderThenName);
  const adminTypeIds = types
    .filter((type) => isSuperAdmin || isTypeAdmin(type, member))
    .map((type) => type.id);

  return { email: context.email, member, isSuperAdmin, types, adminTypeIds };
}

export const canAdminType = (access: ConsultaAccess, typeId: string) =>
  access.adminTypeIds.includes(typeId);

/**
 * Link pessoal: só o dono mexe (nem super admin). Link de um tipo: só quem
 * administra o tipo — o Público apenas abre.
 */
export const canEditLink = (access: ConsultaAccess, link: Pick<ConsultaLink, 'kind' | 'ownerEmail' | 'typeId'>) =>
  link.kind === 'personal'
    ? link.ownerEmail === access.email
    : !!link.typeId && canAdminType(access, link.typeId);

const toMember = (data: DocumentData): AudienceMember | null => {
  const email = String(data.email ?? '').trim().toLowerCase();
  if (!email) return null;
  return { email, area: data.area ?? null, team: data.team ?? null };
};

/** Cadastro atual da pessoa (área e equipe), base para resolver o Público. */
export async function loadMember(email: string): Promise<AudienceMember> {
  const snapshot = await consultaDb().collection('collaborators').where('email', '==', email).limit(1).get();
  return (!snapshot.empty && toMember(snapshot.docs[0].data())) || { email };
}

/** Todos os colaboradores, para o admin ver quem está no Público de cada link. */
export async function loadAllMembers(): Promise<AudienceMember[]> {
  const snapshot = await consultaDb().collection('collaborators').get();
  return snapshot.docs.map((doc) => toMember(doc.data())).filter((member): member is AudienceMember => !!member);
}
