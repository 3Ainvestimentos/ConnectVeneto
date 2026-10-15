/**
 * Ordem do feed. Importantes dentro do período de destaque ficam no topo (mais recente primeiro);
 * o resto segue um score que decai com o tempo, com um bônus limitado por interação.
 * Valores iniciais, a calibrar com o uso do piloto.
 */

const HOUR = 60 * 60 * 1000;
export const HALF_LIFE_HOURS = 24;
export const MAX_ENGAGEMENT_BONUS = 0.5;

export interface Rankable {
  importance: 'normal' | 'importante';
  highlightUntil?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  reactionCounts: Record<string, number>;
  commentCount: number;
}

export const isHighlighted = (p: Rankable, now = Date.now()) =>
  p.importance === 'importante' && !!p.highlightUntil && Date.parse(p.highlightUntil) > now;

export const isExpired = (p: Rankable, now = Date.now()) => !!p.expiresAt && Date.parse(p.expiresAt) < now;

/** score = 0,5^(idade/meia-vida) × (1 + bônus), bônus ≤ 0,5 por reações e comentários. */
export function scorePost(p: Rankable, now = Date.now()): number {
  const ageHours = Math.max(0, (now - Date.parse(p.createdAt)) / HOUR);
  const decay = Math.pow(0.5, ageHours / HALF_LIFE_HOURS);
  const interactions = Object.values(p.reactionCounts ?? {}).reduce((a, b) => a + b, 0) + (p.commentCount ?? 0) * 2;
  const bonus = Math.min(MAX_ENGAGEMENT_BONUS, Math.log10(1 + interactions) / 4);
  return decay * (1 + bonus);
}

export function rankFeed<T extends Rankable>(posts: T[], now = Date.now()): T[] {
  const live = posts.filter((p) => !isExpired(p, now));
  const pinned = live.filter((p) => isHighlighted(p, now)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rest = live.filter((p) => !isHighlighted(p, now)).sort((a, b) => scorePost(b, now) - scorePost(a, now));
  return [...pinned, ...rest];
}
