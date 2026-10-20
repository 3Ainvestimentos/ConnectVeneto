import { z } from 'zod';

/**
 * Consulta Pessoal — biblioteca de links de cada colaborador.
 *
 * Três tipos de link convivem na página:
 * - **Pessoal**: a própria pessoa salva, edita e exclui. Só ela vê.
 * - **Individual** (dentro de um tipo, ex.: MESA): um modelo com título fixo; só quem
 *   tem URL própria cadastrada pelo admin vê ("Planilha MESA" de cada um).
 * - **Compartilhado** (dentro de um tipo): a mesma URL para todo o Público.
 *
 * O Público (empresa toda, áreas, equipes, pessoas) é resolvido na leitura contra o
 * cadastro atual da pessoa: quem entra numa área já vê os links dela, quem sai deixa
 * de ver — sem configurar nada pessoa a pessoa.
 *
 * As coleções são fechadas nas rules (bloqueio padrão): leitura e escrita passam
 * pelas rotas em `/api/consulta`, que conferem dono, admin do tipo e super admin.
 */
export const CONSULTA_LINKS_COLLECTION = 'consultaLinks';
export const CONSULTA_LINK_TYPES_COLLECTION = 'consultaLinkTypes';
/** URL de cada pessoa num link Individual. Id: `<linkId>__<email>`. */
export const CONSULTA_LINK_VALUES_COLLECTION = 'consultaLinkValues';

export type ConsultaLinkType = {
  id: string;
  name: string;
  description: string;
  adminEmails: string[];
  /** Todos da área (cadastro atual) administram o tipo. */
  adminAreas: string[];
  order: number;
};

export type LinkKind = 'personal' | 'individual' | 'shared';

export type Audience = {
  everyone: boolean;
  /** Valores de `collaborators.area`. */
  areas: string[];
  /** Equipes do Organograma (`collaborators.team`). */
  teams: string[];
  emails: string[];
};

export type ConsultaLink = {
  id: string;
  kind: LinkKind;
  /** `null` só em link pessoal. */
  typeId: string | null;
  /** Só em link pessoal. */
  ownerEmail: string | null;
  title: string;
  /** Vazio no modelo de um link Individual — a URL fica em `consultaLinkValues`. */
  url: string;
  description: string;
  /** Só em link Compartilhado. Individual aparece só para quem tem URL própria. */
  audience: Audience | null;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  updatedByEmail: string;
};

export type ConsultaLinkValue = {
  id: string;
  linkId: string;
  typeId: string;
  ownerEmail: string;
  url: string;
  updatedAt: string;
  updatedByEmail: string;
};

/** Link como a pessoa vê na página: Individual já vem com a URL dela. */
export type MyConsultaLink = Omit<ConsultaLink, 'audience'>;

/** O que `GET /api/consulta/links` devolve para a pessoa logada. */
export type ConsultaLinksSession = {
  links: MyConsultaLink[];
  types: ConsultaLinkType[];
  /** Tipos que a pessoa administra (todos, para super admin). */
  adminTypeIds: string[];
  isSuperAdmin: boolean;
};

/** Visão do admin de um tipo: links, URLs individuais e quem está no Público de cada Compartilhado. */
export type TypeAdminData = {
  links: (ConsultaLink & { members: string[] })[];
  values: ConsultaLinkValue[];
};

/** Só http(s): `javascript:` e afins nunca viram link clicável. */
export const linkUrlSchema = z
  .string()
  .trim()
  .min(1, 'Informe o endereço do link.')
  .max(2048, 'URL muito longa.')
  .refine((value) => /^https?:\/\/[^\s]+$/i.test(value), 'O endereço deve começar com http:// ou https://.');

const titleSchema = z.string().trim().min(1, 'Informe um nome para o link.').max(120, 'Nome muito longo.');
const descriptionSchema = z.string().trim().max(300, 'Descrição muito longa.').default('');

export const linkFieldsSchema = z.object({
  title: titleSchema,
  url: linkUrlSchema,
  description: descriptionSchema,
});

const labelList = z.array(z.string().trim().min(1).max(120)).max(100).default([]);

export const emailListSchema = z
  .array(z.string().trim().toLowerCase().email('E-mail inválido.'))
  .max(300, 'Lista de e-mails muito longa.')
  .transform((emails) => Array.from(new Set(emails)));

export const audienceSchema = z
  .object({
    everyone: z.boolean().default(false),
    areas: labelList,
    teams: labelList,
    emails: emailListSchema.default([]),
  })
  .strict()
  .refine(
    (audience) => audience.everyone || audience.areas.length + audience.teams.length + audience.emails.length > 0,
    'Escolha com quem o link é compartilhado.'
  );

/** Link de um tipo: Individual (sem URL no modelo) ou Compartilhado (com URL). */
export const typedLinkSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('individual'), title: titleSchema, description: descriptionSchema }).strict(),
  z.object({ kind: z.literal('shared'), title: titleSchema, url: linkUrlSchema, description: descriptionSchema, audience: audienceSchema }).strict(),
]);

export const linkTypeFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do tipo.').max(40, 'Nome muito longo.'),
  description: z.string().trim().max(200, 'Descrição muito longa.').default(''),
  adminEmails: emailListSchema.default([]),
  adminAreas: labelList,
  order: z.number().int().min(0).max(999).default(0),
});

export const PERSONAL_SECTION_LABEL = 'Meus links';

/** Teto de links pessoais por pessoa — a página é uma barra de favoritos, não um acervo. */
export const MAX_PERSONAL_LINKS = 100;

export const valueDocId = (linkId: string, email: string) => `${linkId}__${email.toLowerCase()}`;

/** Área/equipe comparável: sem acento, minúscula, espaços simples. */
export function normalizeLabel(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Valores de cadastro que não são área de verdade ("—", "-", vazio). */
export const isBlankLabel = (value: string | null | undefined) => !normalizeLabel(value).replace(/[-—–]/g, '');

export type AudienceMember = { email: string; area?: string | null; team?: string | null };

/** A pessoa está no Público? Resolvido sempre contra o cadastro atual. */
export function isInAudience(audience: Audience | null, person: AudienceMember): boolean {
  if (!audience) return false;
  if (audience.everyone) return true;
  const email = person.email.toLowerCase();
  if (audience.emails.includes(email)) return true;
  const area = normalizeLabel(person.area);
  if (area && audience.areas.some((value) => normalizeLabel(value) === area)) return true;
  const team = normalizeLabel(person.team);
  return !!team && audience.teams.some((value) => normalizeLabel(value) === team);
}

/** Admin do tipo pelo e-mail ou pela área atual do cadastro (super admin é tratado à parte). */
export function isTypeAdmin(type: Pick<ConsultaLinkType, 'adminEmails' | 'adminAreas'>, person: AudienceMember): boolean {
  return isInAudience({ everyone: false, areas: type.adminAreas, teams: [], emails: type.adminEmails }, person);
}

/** "Empresa toda" · "Áreas: Mesa, CX" · "3 pessoas". */
export function describeAudience(audience: Audience | null): string {
  if (!audience) return '';
  if (audience.everyone) return 'Empresa toda';
  const parts: string[] = [];
  if (audience.areas.length) parts.push(`${audience.areas.length > 1 ? 'Áreas' : 'Área'}: ${audience.areas.join(', ')}`);
  if (audience.teams.length) parts.push(`${audience.teams.length > 1 ? 'Equipes' : 'Equipe'}: ${audience.teams.join(', ')}`);
  if (audience.emails.length) parts.push(`${audience.emails.length} ${audience.emails.length > 1 ? 'pessoas' : 'pessoa'}`);
  return parts.join(' · ');
}

/** Domínio exibido no card ("docs.google.com"). */
export function linkHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
