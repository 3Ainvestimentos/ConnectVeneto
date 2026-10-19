"use client";

/**
 * Resumo diário: na primeira visita do dia, mostra as Notícias (publicações Normais) dos canais que
 * a pessoa segue, publicadas desde o último resumo que ela viu. Para quem está no piloto, substitui
 * o Daily Fin. Sem nada novo, não abre.
 *
 * `onDemand` (botões "Abrir resumo" e "Resumo") abre na hora, desde `since` (último resumo visto
 * ou, sem histórico, 7 dias) e não mexe no "visto".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BarChart3, CalendarDays, Loader2, Newspaper, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useHubDigestApi } from '@/hooks/useHubFeed';
import type { DigestItem, DigestResponse } from '@/lib/hub/model';
import { cn } from '@/lib/utils';
import { shortDate, timeAgo } from './format';

const SHOWN_KEY = 'hubDigestShownDate';
const OPEN_DELAY_MS = 1500;
const ON_DEMAND_DEFAULT_DAYS = 7;

/** Data local (AAAA-MM-DD): "uma vez por dia" no fuso da pessoa, não em UTC. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readShown(): string | null {
  try {
    return localStorage.getItem(SHOWN_KEY);
  } catch {
    return null;
  }
}

function writeShown() {
  try {
    localStorage.setItem(SHOWN_KEY, localToday());
  } catch {
    /* sem storage: o resumo pode reaparecer, sem outro efeito */
  }
}

const postHref = (id: string) => `/publicacoes?p=${id}`;

function MediaIcons({ item }: { item: DigestItem }) {
  return (
    <>
      {item.hasVideo && <PlayCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Tem vídeo" />}
      {item.hasEvent && <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Tem evento" />}
      {item.hasPoll && <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Tem enquete" />}
    </>
  );
}

/** Miniatura com <img> simples: imagens das notícias migradas vêm de hosts fora da lista do next/image. */
function Thumb({ url, className }: { url?: string; className?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" loading="lazy" className={cn('rounded-lg object-cover', className)} />
  ) : (
    <span className={cn('flex items-center justify-center rounded-lg bg-muted text-muted-foreground', className)}>
      <Newspaper className="h-6 w-6" aria-hidden />
    </span>
  );
}

function Hero({ item, onPick }: { item: DigestItem; onPick: () => void }) {
  return (
    <Link href={postHref(item.id)} onClick={onPick} className="group grid gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50">
      <Thumb url={item.imageUrl} className="aspect-video w-full" />
      <div className="grid gap-1 px-1 pb-1">
        <span className="text-xs font-bold uppercase tracking-wider text-primary">{item.channelName}</span>
        <span className="flex items-center gap-2 font-headline text-xl font-semibold leading-snug group-hover:underline">
          {item.title}
          <MediaIcons item={item} />
        </span>
        <span className="text-sm text-muted-foreground">
          {item.authorName} · {timeAgo(item.createdAt)}
        </span>
        {item.excerpt && <p className="line-clamp-2 text-base">{item.excerpt}</p>}
      </div>
    </Link>
  );
}

function ItemRow({ item, onPick }: { item: DigestItem; onPick: () => void }) {
  return (
    <li>
      <Link href={postHref(item.id)} onClick={onPick} className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-muted">
        <Thumb url={item.imageUrl} className="h-[72px] w-24 shrink-0" />
        <span className="grid min-w-0 content-start gap-0.5">
          <span className="flex items-center gap-2 font-semibold leading-snug">
            <span className="line-clamp-2">{item.title}</span>
            <MediaIcons item={item} />
          </span>
          <span className="text-sm text-muted-foreground">
            {item.authorName} · {timeAgo(item.createdAt)}
          </span>
          {item.excerpt && <span className="line-clamp-1 text-sm text-muted-foreground">{item.excerpt}</span>}
        </span>
      </Link>
    </li>
  );
}

export function HubDigestModal({
  onDemand = false,
  since,
  onOpenChange,
}: {
  onDemand?: boolean;
  /** Só no modo sob demanda: início da janela (último resumo visto). */
  since?: string | null;
  onOpenChange?: (open: boolean) => void;
}) {
  const { fetchDigest, markSeen } = useHubDigestApi();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(false);

  // Abertura automática: uma vez por dia, só se houver novidade.
  useEffect(() => {
    if (onDemand || started.current) return;
    started.current = true;
    if (readShown() === localToday()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    fetchDigest()
      .then((d) => {
        if (d.channels.length === 0) return;
        setData(d);
        timer = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
      })
      .catch(() => {
        /* fora do piloto ou falha de rede: simplesmente não mostra */
      });
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDemand]);

  // Sob demanda: abre já, desde o último resumo visto (ou 7 dias).
  useEffect(() => {
    if (!onDemand) return;
    setOpen(true);
    setLoading(true);
    setError('');
    fetchDigest(since ?? new Date(Date.now() - ON_DEMAND_DEFAULT_DAYS * 24 * 3600 * 1000).toISOString())
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Não foi possível carregar o resumo.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDemand]);

  const close = useCallback(() => {
    setOpen(false);
    if (onDemand) {
      onOpenChange?.(false);
      return;
    }
    writeShown();
    markSeen().catch(() => {
      /* sem gravar o "visto", o próximo resumo repete itens; nada além disso */
    });
  }, [onDemand, onOpenChange, markSeen]);

  // A Notícia mais recente com imagem abre o resumo em destaque; o resto segue agrupado por canal.
  const { hero, groups, total } = useMemo(() => {
    const all = data?.channels.flatMap((c) => c.posts) ?? [];
    const withImage = all.filter((p) => p.imageUrl).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const top = withImage[0] ?? all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
    return {
      hero: top,
      groups: (data?.channels ?? []).map((c) => ({ ...c, posts: c.posts.filter((p) => p.id !== top?.id) })).filter((c) => c.posts.length > 0),
      total: all.length,
    };
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-5 text-left">
          <DialogTitle className="flex items-center gap-2 font-headline text-xl">
            <Newspaper className="h-5 w-5 text-primary" /> {onDemand ? 'Resumo das notícias' : 'Enquanto você estava fora'}
          </DialogTitle>
          <DialogDescription className="text-base">
            {data
              ? `${total} ${total === 1 ? 'notícia' : 'notícias'} nos canais que você segue, desde ${shortDate(data.since)}.`
              : 'Notícias dos canais que você segue.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <p className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Montando o resumo…
            </p>
          )}
          {error && <p className="py-6 text-destructive">{error}</p>}
          {!loading && !error && data && total === 0 && (
            <p className="py-6 text-muted-foreground">Nenhuma notícia nova nos canais que você segue.</p>
          )}
          <div className="grid gap-6">
            {hero && <Hero item={hero} onPick={close} />}
            {groups.map((c) => (
              <section key={c.id} className="grid gap-1">
                <h3 className="px-2 text-xs font-bold uppercase tracking-wider text-primary">
                  {c.name} <span className="font-medium text-muted-foreground">· {c.posts.length}</span>
                </h3>
                <ul className="grid gap-0.5">
                  {c.posts.map((p) => (
                    <ItemRow key={p.id} item={p} onPick={close} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={close}>
            Fechar
          </Button>
          <Button asChild>
            <Link href="/publicacoes" onClick={close}>
              Ver todas as publicações
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
