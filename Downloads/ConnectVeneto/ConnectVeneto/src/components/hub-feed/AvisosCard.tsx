"use client";

import { useState } from 'react';
import { ArrowUpRight, BellRing, CalendarDays, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useHubFeed, useHubFeedActions } from '@/hooks/useHubFeed';
import { activeAvisos } from '@/lib/hub/home';
import { RSVP_ANSWERS, type FeedPost, type RsvpAnswer } from '@/lib/hub/model';
import { cn } from '@/lib/utils';
import { PostDialog } from './PostDialog';
import { shortDate } from './format';

const RSVP_LABEL: Record<RsvpAnswer, string> = { vou: 'Vou', talvez: 'Talvez', nao: 'Não vou' };
const time = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "05/11 · 09:00 · local" para evento; "até 31/10" para prazo. */
function Deadline({ post }: { post: FeedPost }) {
  if (post.event) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
        {shortDate(post.event.start)} · {time(post.event.start)}
        {post.event.place && <span className="truncate">· {post.event.place}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Clock className="h-4 w-4 shrink-0" aria-hidden />
      até {shortDate(post.highlightUntil!)}
    </span>
  );
}

function AvisoItem({ post, channelName, onOpen }: { post: FeedPost; channelName: string; onOpen: () => void }) {
  const { rsvp } = useHubFeedActions();
  const button = post.buttons[0];
  const choose = (answer: RsvpAnswer) =>
    rsvp
      .mutateAsync({ postId: post.id, answer: post.myRsvp === answer ? null : answer })
      .catch((e) => toast({ title: 'Não deu certo', description: e instanceof Error ? e.message : 'Tente de novo.', variant: 'destructive' }));

  return (
    <li className="relative grid gap-2 border-l-4 border-l-primary py-1 pl-4">
      <button type="button" onClick={onOpen} className="grid gap-1 text-left after:absolute after:inset-0 after:content-['']" aria-label={`Abrir aviso: ${post.title}`}>
        <span className="text-base font-semibold leading-snug">{post.title}</span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm font-medium text-primary">
          <Deadline post={post} />
        </span>
        <span className="line-clamp-2 text-sm text-muted-foreground">{post.body}</span>
      </button>
      {/* Ações ficam acima do botão que cobre o item (z-10). */}
      {(button || post.event) && (
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          {post.event &&
            RSVP_ANSWERS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => choose(a)}
                aria-pressed={post.myRsvp === a}
                className={cn(
                  'rounded-md border px-3 py-1 text-sm font-medium transition-colors',
                  post.myRsvp === a ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
                )}
              >
                {RSVP_LABEL[a]}
              </button>
            ))}
          {button && (
            <a
              href={button.href}
              {...(button.href.startsWith('/') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {button.label} <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
      <span className="text-xs text-muted-foreground">{channelName}</span>
    </li>
  );
}

/** Avisos: recados com prazo (publicações Importantes dentro da validade), do mais urgente ao mais distante. */
export function AvisosCard() {
  const { data, isLoading } = useHubFeed();
  const [openId, setOpenId] = useState<string | null>(null);
  const avisos = activeAvisos(data?.posts ?? []);
  const channelName = (id: string) => data?.channels.find((c) => c.id === id)?.name ?? '';

  return (
    <Card className="shadow-sm">
      <div className="flex items-center justify-between gap-2 px-5 pt-5">
        <h2 className="inline-flex items-center gap-2 font-headline text-lg font-semibold">
          <BellRing className="h-5 w-5 text-primary" aria-hidden /> Avisos
        </h2>
        {avisos.length > 0 && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold text-primary">{avisos.length}</span>}
      </div>
      <div className="px-5 pb-5 pt-4">
        {isLoading && <div className="h-24 animate-pulse rounded-lg bg-muted" />}
        {data && avisos.length === 0 && <p className="text-base text-muted-foreground">Nenhum aviso por enquanto.</p>}
        {avisos.length > 0 && (
          <ul className="grid gap-5">
            {avisos.map((p) => (
              <AvisoItem key={p.id} post={p} channelName={channelName(p.channelId)} onOpen={() => setOpenId(p.id)} />
            ))}
          </ul>
        )}
      </div>
      <PostDialog postId={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </Card>
  );
}
