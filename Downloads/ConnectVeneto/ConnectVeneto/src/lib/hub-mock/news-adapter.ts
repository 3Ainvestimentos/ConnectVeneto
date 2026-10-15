import type { NewsItemType } from '@/contexts/NewsContext';
import type { Post } from './types';

const DAY = 24 * 60 * 60 * 1000;
/** Quanto tempo uma Notícia marcada como destaque fica fixada no topo do feed. */
const HIGHLIGHT_DAYS = 14;

/** Tira marcação simples (markdown/HTML) para usar o conteúdo como resumo. */
function plainText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_>`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Notícia publicada pelo RH → Publicação no canal Institucional.
 * `newsItems` não tem autor nem createdAt; usamos a data da notícia e o autor institucional.
 */
export function newsToPosts(items: NewsItemType[]): Post[] {
  return items
    .filter((n) => n.status === 'published')
    .map((n) => {
      const createdAt = new Date(n.date).toISOString();
      const summary = n.snippet?.trim() || plainText(n.content).slice(0, 320);
      return {
        id: `news-${n.id}`,
        source: 'news' as const,
        channelId: 'institucional',
        authorId: 'comunicacao',
        title: n.title,
        body: summary,
        createdAt,
        importance: n.isHighlight ? ('importante' as const) : ('normal' as const),
        highlightUntil: n.isHighlight ? new Date(new Date(n.date).getTime() + HIGHLIGHT_DAYS * DAY).toISOString() : undefined,
        coverUrl: n.imageUrl || undefined,
        link: n.link ? { label: 'Saiba mais', href: n.link } : { label: 'Ler a notícia completa', href: '/news' },
        reactions: {},
        comments: [],
      };
    });
}
