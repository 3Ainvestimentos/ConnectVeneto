"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Newspaper, PlayCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useHubFeed } from '@/hooks/useHubFeed';
import { countNewSince, followedNews } from '@/lib/hub/home';
import type { FeedPost } from '@/lib/hub/model';
import { cn } from '@/lib/utils';
import { PostDialog } from './PostDialog';
import { timeAgo } from './format';

/** Um destaque grande + dois menores, como os destaques de Notícias do Painel Inicial. */
const SHOWN = 3;

function Tile({ post, channelName, large, onOpen }: { post: FeedPost; channelName: string; large?: boolean; onOpen: () => void }) {
  const image = post.images[0]?.url;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn('group relative min-h-[160px] overflow-hidden rounded-xl text-left', large && 'md:row-span-2 md:min-h-[340px]')}
      aria-label={`Abrir notícia: ${post.title}`}
    >
      {image ? (
        // <img> simples: imagens das notícias migradas vêm de hosts fora da lista do next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      ) : (
        <span className="absolute inset-0 bg-gradient-to-br from-primary/80 to-primary" aria-hidden />
      )}
      <span className="absolute inset-0 flex flex-col justify-end gap-1 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
          {channelName} · {timeAgo(post.createdAt)}
        </span>
        <span className={cn('flex items-center gap-2 font-headline font-bold leading-snug text-white', large ? 'text-xl md:text-2xl' : 'text-base')}>
          <span className="line-clamp-2">{post.title}</span>
          {post.video && <PlayCircle className="h-5 w-5 shrink-0" aria-label="Tem vídeo" />}
        </span>
        {large && post.body && <span className="line-clamp-2 text-sm text-white/85">{post.body}</span>}
      </span>
    </button>
  );
}

/**
 * Mini-feed das Notícias na Home: as mais recentes dos canais seguidos em mosaico de imagens.
 * Clicar abre a notícia por cima da página; o histórico completo fica em /publicacoes. Quando o card
 * estica (último da coluna), o mosaico cresce junto.
 */
export function PublicacoesFeedCard() {
  const { data } = useHubFeed();
  const [openId, setOpenId] = useState<string | null>(null);

  const { latest, fresh } = useMemo(() => {
    if (!data) return { latest: [], fresh: 0 };
    const followed = data.channels.filter((c) => c.following).map((c) => c.id);
    return {
      latest: followedNews(data.posts, followed, data.viewer.email).slice(0, SHOWN),
      fresh: countNewSince(data.posts, followed, data.digestSeenAt, data.viewer.email),
    };
  }, [data]);
  const channelName = (id: string) => data?.channels.find((c) => c.id === id)?.name ?? '';

  return (
    <Card className="flex flex-col shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="inline-flex items-center gap-2 font-headline text-lg font-semibold">
            <Newspaper className="h-5 w-5 text-primary" aria-hidden /> Publicações
          </h2>
          {fresh > 0 && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold text-primary">
              {fresh} {fresh === 1 ? 'nova' : 'novas'} desde o último resumo
            </span>
          )}
        </div>
        <Link href="/publicacoes" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          ver todas <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        {!data && <div className="h-[340px] animate-pulse rounded-xl bg-muted" />}
        {data && latest.length === 0 && <p className="text-base text-muted-foreground">Nada publicado nos canais que você segue.</p>}
        {latest.length > 0 && (
          <div className={cn('grid flex-1 gap-3 md:auto-rows-fr', latest.length === 3 && 'md:grid-cols-[3fr_2fr]', latest.length === 2 && 'md:grid-cols-2')}>
            {latest.map((p, i) => (
              <Tile key={p.id} post={p} channelName={channelName(p.channelId)} large={i === 0 && latest.length === 3} onOpen={() => setOpenId(p.id)} />
            ))}
          </div>
        )}
      </div>

      <PostDialog postId={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </Card>
  );
}
