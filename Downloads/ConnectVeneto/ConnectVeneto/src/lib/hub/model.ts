/**
 * Modelo de dados do Hub de Comunicação (Fase 1, Firestore).
 *
 * Desenhado para migrar para o Azure SQL sem remodelar: cada coleção é plana, vira uma tabela,
 * e as relações são chaves explícitas (`postId`, `channelId`, e-mail da pessoa). Nada de
 * subcoleções. Pessoa = e-mail corporativo normalizado (é o que o login Google entrega).
 * Datas são ISO 8601 em UTC. Contadores em `hubPosts` são desnormalizações, recalculáveis a partir
 * das tabelas de origem.
 */
import { z } from 'zod';

export const HUB_COLLECTIONS = {
  channels: 'hubChannels',
  posts: 'hubPosts',
  comments: 'hubComments',
  reactions: 'hubReactions',
  rsvps: 'hubEventRsvps',
  pollVotes: 'hubPollVotes',
  follows: 'hubChannelFollows',
} as const;

/** Módulo interno que libera a nova Home durante o piloto (accessMode 'explicit'). */
export const HUB_PILOT_MODULE_ID = 'inicio';
/** Canal que recebe as Notícias migradas de `newsItems`. */
export const INSTITUTIONAL_CHANNEL_ID = 'institucional';
/** Pasta do Storage para mídia e anexos das publicações. */
export const HUB_STORAGE_FOLDER = 'publicacoes';

export const REACTION_EMOJIS = ['👍', '❤️', '👏', '💡', '🎉'] as const;
export const RSVP_ANSWERS = ['vou', 'talvez', 'nao'] as const;
export const IMPORTANCE = ['normal', 'importante'] as const;
export const POST_STATUS = ['published', 'archived'] as const;

export type Importance = (typeof IMPORTANCE)[number];
export type RsvpAnswer = (typeof RSVP_ANSWERS)[number];

// ---------- Tabelas ----------

export interface HubChannel {
  id: string; // slug estável (ex.: 'tecnologia')
  name: string;
  ownerEmail: string;
  /** Quem pode publicar no canal além da Comunicação (canManageContent). */
  publisherEmails: string[];
  /** Canais semeados entram no feed de todos até a pessoa deixar de seguir. */
  seeded: boolean;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HubImage {
  url: string;
  storagePath?: string;
  name?: string;
}
export interface HubVideo {
  kind: 'upload' | 'youtube' | 'drive' | 'link';
  url: string;
  storagePath?: string;
  name?: string;
}
export interface HubFile {
  url: string;
  storagePath?: string;
  name: string;
  size?: number;
}
export interface HubButton {
  label: string;
  href: string;
}
export interface HubEvent {
  start: string;
  end?: string;
  place: string;
  audience: 'Interno' | 'Clientes';
  calendarEventId?: string;
}
export interface HubPoll {
  options: string[];
  closesAt: string;
}

export interface HubPost {
  id: string;
  channelId: string;
  authorEmail: string;
  /** Retrato do autor no momento da publicação (nome/cargo podem mudar depois). */
  authorName: string;
  authorPosition?: string;
  title: string;
  body: string;
  importance: Importance;
  highlightUntil?: string;
  expiresAt?: string;
  images: HubImage[];
  video?: HubVideo;
  files: HubFile[];
  buttons: HubButton[];
  event?: HubEvent;
  poll?: HubPoll;
  status: (typeof POST_STATUS)[number];
  /** Origem: publicação nativa ou Notícia migrada de `newsItems`. */
  source: 'hub' | 'news';
  legacyNewsId?: string;
  createdAt: string;
  updatedAt: string;
  // Desnormalizações (recalculáveis):
  commentCount: number;
  relevantCommentCount: number;
  reactionCounts: Record<string, number>;
  rsvpCounts: Record<RsvpAnswer, number>;
  pollCounts: number[];
}

export interface HubComment {
  id: string;
  postId: string;
  authorEmail: string;
  authorName: string;
  text: string;
  /** Só comentários marcados pelo autor da publicação aparecem para todos. */
  relevant: boolean;
  relevantMarkedAt?: string;
  createdAt: string;
}

/** Uma reação por pessoa por publicação. id = `${postId}__${email}`. */
export interface HubReaction {
  id: string;
  postId: string;
  email: string;
  emoji: string;
  createdAt: string;
}

/** id = `${postId}__${email}`. */
export interface HubEventRsvp {
  id: string;
  postId: string;
  email: string;
  answer: RsvpAnswer;
  updatedAt: string;
}

/** Um voto por pessoa por enquete. id = `${postId}__${email}`. */
export interface HubPollVote {
  id: string;
  postId: string;
  email: string;
  optionIndex: number;
  createdAt: string;
}

/** Estado explícito de seguir/deixar de seguir. id = `${email}__${channelId}`. */
export interface HubChannelFollow {
  id: string;
  email: string;
  channelId: string;
  following: boolean;
  notify: 'feed' | 'bell';
  updatedAt: string;
}

export const pairId = (a: string, b: string) => `${a}__${b}`;

// ---------- Entradas da API ----------

const httpsUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => /^https:\/\/[^\s]+$/.test(v), 'O endereço deve começar com https://.');
const storagePath = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v.startsWith(`${HUB_STORAGE_FOLDER}/`), 'Caminho de arquivo inválido.');
const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida.');

export const createPostSchema = z.object({
  channelId: z.string().trim().min(1).max(60),
  title: z.string().trim().min(3, 'O título precisa de pelo menos 3 letras.').max(200),
  body: z.string().trim().min(1, 'Escreva o texto da publicação.').max(10000),
  importance: z.enum(IMPORTANCE).default('normal'),
  highlightUntil: isoDate.optional(),
  images: z.array(z.object({ url: httpsUrl, storagePath: storagePath.optional(), name: z.string().max(200).optional() })).max(10).default([]),
  video: z
    .object({ kind: z.enum(['upload', 'youtube', 'drive', 'link']), url: httpsUrl, storagePath: storagePath.optional(), name: z.string().max(200).optional() })
    .optional(),
  files: z.array(z.object({ url: httpsUrl, storagePath: storagePath.optional(), name: z.string().trim().min(1).max(200), size: z.number().int().nonnegative().optional() })).max(10).default([]),
  buttons: z.array(z.object({ label: z.string().trim().min(1).max(40), href: httpsUrl })).max(3).default([]),
  event: z
    .object({
      start: isoDate,
      end: isoDate.optional(),
      place: z.string().trim().max(200).default(''),
      audience: z.enum(['Interno', 'Clientes']).default('Interno'),
      calendarEventId: z.string().max(200).optional(),
    })
    .optional(),
  poll: z.object({ options: z.array(z.string().trim().min(1).max(120)).min(2).max(6), closesAt: isoDate }).optional(),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = z
  .object({
    status: z.enum(POST_STATUS),
    importance: z.enum(IMPORTANCE),
    highlightUntil: isoDate.nullable(),
    title: z.string().trim().min(3).max(200),
    body: z.string().trim().min(1).max(10000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nada para atualizar.');

export const commentSchema = z.object({ text: z.string().trim().min(1, 'Escreva o comentário.').max(2000) });
export const reactionSchema = z.object({ emoji: z.enum(REACTION_EMOJIS).nullable() });
export const rsvpSchema = z.object({ answer: z.enum(RSVP_ANSWERS).nullable() });
export const voteSchema = z.object({ optionIndex: z.number().int().min(0).max(5) });
export const followSchema = z.object({ following: z.boolean(), notify: z.enum(['feed', 'bell']).optional() });

// ---------- Respostas da API (o que o cliente recebe) ----------

export interface FeedComment {
  id: string;
  authorEmail: string;
  authorName: string;
  text: string;
  relevant: boolean;
  createdAt: string;
}

export interface FeedPost extends Omit<HubPost, 'legacyNewsId'> {
  myReaction: string | null;
  myRsvp: RsvpAnswer | null;
  myVote: number | null;
  /** Autor da publicação: pode marcar comentários e editar. */
  canManage: boolean;
}

export interface FeedChannel {
  id: string;
  name: string;
  following: boolean;
  notify: 'feed' | 'bell';
  canPublish: boolean;
}
