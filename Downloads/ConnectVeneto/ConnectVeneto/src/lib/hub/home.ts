/**
 * Regras da Home sobre as Publicações: quais Notícias são novas (desde o último Resumo visto)
 * e quais Avisos estão valendo. Mesmo critério do `listDigest` no servidor.
 */
import { isExpired, isHighlighted, type Rankable } from './ranking';

interface PostLike extends Rankable {
  channelId: string;
  authorEmail: string;
}

/** Notícias dos canais seguidos, de outras pessoas, mais recentes primeiro. Eventos ficam na Agenda. */
export function followedNews<T extends PostLike>(posts: T[], followedChannelIds: Iterable<string>, viewerEmail: string): T[] {
  const followed = new Set(followedChannelIds);
  const isNews = (p: T) => (p.kind ? p.kind === 'noticia' : p.importance === 'normal' && !p.event);
  return posts
    .filter((p) => isNews(p) && followed.has(p.channelId) && p.authorEmail !== viewerEmail && !isExpired(p))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Quantas Notícias chegaram depois do último Resumo visto (sem histórico: nenhuma marcada como nova). */
export function countNewSince<T extends PostLike>(
  posts: T[],
  followedChannelIds: Iterable<string>,
  digestSeenAt: string | null,
  viewerEmail: string,
): number {
  if (!digestSeenAt) return 0;
  return followedNews(posts, followedChannelIds, viewerEmail).filter((p) => p.createdAt > digestSeenAt).length;
}

/** Data que vence o Aviso: o fim do prazo (Aviso não tem evento; evento é outro tipo de Publicação). */
export function avisoDeadline(p: Rankable): string | null {
  return p.highlightUntil ?? null;
}

/** Avisos valendo agora, do prazo mais próximo para o mais distante. Eventos não entram (vão para a Agenda). */
export function activeAvisos<T extends Rankable>(posts: T[], now = Date.now()): T[] {
  return posts
    .filter((p) => isHighlighted(p, now) && !isExpired(p, now))
    .sort((a, b) => (avisoDeadline(a) ?? '').localeCompare(avisoDeadline(b) ?? ''));
}
