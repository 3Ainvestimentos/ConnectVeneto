"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Newspaper } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useHubFeed } from '@/hooks/useHubFeed';
import { countNewSince, followedNews } from '@/lib/hub/home';
import { HubDigestModal } from './HubDigestModal';
import { timeAgo } from './format';

const LATEST = 5;

/** Ponte para as Notícias: quantas chegaram desde o último Resumo e as mais recentes. */
export function PublicacoesMiniCard() {
  const { data } = useHubFeed();
  const [digestOpen, setDigestOpen] = useState(false);

  const { latest, fresh } = useMemo(() => {
    if (!data) return { latest: [], fresh: 0 };
    const followed = data.channels.filter((c) => c.following).map((c) => c.id);
    return {
      latest: followedNews(data.posts, followed, data.viewer.email).slice(0, LATEST),
      fresh: countNewSince(data.posts, followed, data.digestSeenAt, data.viewer.email),
    };
  }, [data]);
  const channelName = (id: string) => data?.channels.find((c) => c.id === id)?.name ?? '';

  return (
    <Card className="shadow-sm">
      <div className="flex items-center justify-between gap-2 px-5 pt-5">
        <h2 className="inline-flex items-center gap-2 font-headline text-lg font-semibold">
          <Newspaper className="h-5 w-5 text-primary" aria-hidden /> Publicações
        </h2>
        <Link href="/publicacoes" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          ver todas <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid gap-3 px-5 pb-5 pt-3">
        <p className="text-sm text-muted-foreground">
          {fresh > 0 ? `${fresh} ${fresh === 1 ? 'notícia nova' : 'notícias novas'} desde o último resumo` : 'Notícias dos canais que você segue'}
        </p>
        {data && latest.length === 0 && <p className="text-base text-muted-foreground">Nada publicado ainda.</p>}
        <ul className="grid gap-1">
          {latest.map((p) => (
            <li key={p.id}>
              <Link href={`/publicacoes?p=${p.id}`} className="-mx-2 flex items-center gap-3 rounded-lg p-2 hover:bg-muted">
                {p.images[0]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0].url} alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Newspaper className="h-5 w-5" aria-hidden />
                  </span>
                )}
                <span className="grid min-w-0 gap-0.5">
                  <span className="line-clamp-2 text-[15px] font-medium leading-snug">{p.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {channelName(p.channelId)} · {timeAgo(p.createdAt)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {data && (
          <button type="button" onClick={() => setDigestOpen(true)} className="justify-self-start text-sm font-medium text-primary hover:underline">
            Abrir resumo
          </button>
        )}
      </div>
      {digestOpen && <HubDigestModal onDemand since={data?.digestSeenAt} onOpenChange={setDigestOpen} />}
    </Card>
  );
}
