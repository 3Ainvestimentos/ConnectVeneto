/**
 * Regras da Home sobre as Publicações: quais Notícias são novas (desde o último Resumo visto)
 * e quais Avisos estão valendo. Mesmo critério do `listDigest` no servidor.
 */
import { isExpired, isHighlighted, type Rankable } from './ranking';

interface PostLike extends Rankable {
  channelId: string;
  authorEmail: string;
}

/** Notícias (Normais) dos canais seguidos, de outras pessoas, mais recentes primeiro. */
export function followedNews<T extends PostLike>(posts: T[], followedChannelIds: Iterable<string>, viewerEmail: string): T[] {
  const followed = new Set(followedChannelIds);
  return posts
    .filter((p) => p.importance === 'normal' && followed.has(p.channelId) && p.authorEmail !== viewerEmail && !isExpired(p))
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

/** Data que vence o Aviso: o evento, se houver; senão o fim do prazo. */
export function avisoDeadline(p: Rankable & { event?: { start: string } | null }): string | null {
  return p.event?.start ?? p.highlightUntil ?? null;
}

/** Avisos valendo agora, do prazo mais próximo para o mais distante. */
export function activeAvisos<T extends Rankable & { event?: { start: string } | null }>(posts: T[], now = Date.now()): T[] {
  return posts
    .filter((p) => isHighlighted(p, now) && !isExpired(p, now))
    .sort((a, b) => (avisoDeadline(a) ?? '').localeCompare(avisoDeadline(b) ?? ''));
}
