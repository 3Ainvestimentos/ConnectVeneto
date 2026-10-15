import type { Post } from './types';

const HOUR = 60 * 60 * 1000;
/** Meia-vida do score de uma publicação comum. Valor inicial, a calibrar. */
export const HALF_LIFE_HOURS = 24;
/** Teto do bônus de interação, para uma publicação muito comentada não enterrar as demais. */
export const MAX_ENGAGEMENT_BONUS = 0.5;

export function isHighlighted(post: Post, now = Date.now()): boolean {
  return post.importance === 'importante' && !!post.highlightUntil && new Date(post.highlightUntil).getTime() > now;
}

export function isExpired(post: Post, now = Date.now()): boolean {
  return !!post.expiresAt && new Date(post.expiresAt).getTime() < now;
}

/** score = 0,5^(idade/meia-vida) + bônus de interação limitado. */
export function scorePost(post: Post, now = Date.now()): number {
  const ageHours = Math.max(0, (now - new Date(post.createdAt).getTime()) / HOUR);
  const decay = Math.pow(0.5, ageHours / HALF_LIFE_HOURS);
  const interactions =
    Object.values(post.reactions).reduce((a, b) => a + b, 0) + post.comments.length * 2;
  const bonus = Math.min(MAX_ENGAGEMENT_BONUS, Math.log10(1 + interactions) / 4);
  return decay + bonus * decay;
}

/**
 * Ordem do feed: publicações Importantes dentro do período de destaque primeiro (mais recente no topo),
 * depois o resto pelo score. Publicações vencidas saem.
 */
export function rankFeed(posts: Post[], now = Date.now()): Post[] {
  const live = posts.filter((p) => !isExpired(p, now));
  const pinned = live
    .filter((p) => isHighlighted(p, now))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rest = live
    .filter((p) => !isHighlighted(p, now))
    .sort((a, b) => scorePost(b, now) - scorePost(a, now));
  return [...pinned, ...rest];
}
