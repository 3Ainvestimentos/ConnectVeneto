"use client";

/**
 * Resumo diário: na primeira visita do dia, mostra as publicações Normais dos canais que a pessoa
 * segue, publicadas desde o último resumo que ela viu. Para quem está no piloto, substitui o
 * Daily Fin. Sem nada novo, não abre.
 *
 * `forceOpen` (botão "Testar resumo") abre na hora com os últimos 30 dias e não mexe no "visto".
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BarChart3, CalendarDays, Loader2, Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useHubDigestApi } from '@/hooks/useHubFeed';
import type { DigestResponse } from '@/lib/hub/model';
import { shortDate, timeAgo } from './format';

const SHOWN_KEY = 'hubDigestShownDate';
const OPEN_DELAY_MS = 1500;
const TEST_WINDOW_DAYS = 30;

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

export function HubDigestModal({ forceOpen = false, onOpenChange }: { forceOpen?: boolean; onOpenChange?: (open: boolean) => void }) {
  const { fetchDigest, markSeen } = useHubDigestApi();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(false);

  // Abertura automática: uma vez por dia, só se houver novidade.
  useEffect(() => {
    if (forceOpen || started.current) return;
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
  }, [forceOpen]);

  // Modo teste: abre já, com os últimos 30 dias.
  useEffect(() => {
    if (!forceOpen) return;
    setOpen(true);
    setLoading(true);
    setError('');
    fetchDigest(new Date(Date.now() - TEST_WINDOW_DAYS * 24 * 3600 * 1000).toISOString())
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Não foi possível carregar o resumo.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceOpen]);

  const close = useCallback(() => {
    setOpen(false);
    if (forceOpen) {
      onOpenChange?.(false);
      return;
    }
    writeShown();
    markSeen().catch(() => {
      /* sem gravar o "visto", o próximo resumo repete itens; nada além disso */
    });
  }, [forceOpen, onOpenChange, markSeen]);

  const total = data?.channels.reduce((n, c) => n + c.posts.length, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="flex items-center gap-2 font-headline text-xl">
            <Newspaper className="h-5 w-5 text-primary" /> Resumo do que foi publicado
          </DialogTitle>
          <DialogDescription className="text-base">
            {data ? `Nos canais que você segue, desde ${shortDate(data.since)}.` : 'Nos canais que você segue.'}
            {forceOpen && ' Modo de teste: últimos 30 dias, sem marcar como visto.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <p className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Montando o resumo…
            </p>
          )}
          {error && <p className="py-6 text-destructive">{error}</p>}
          {!loading && !error && data && total === 0 && (
            <p className="py-6 text-muted-foreground">Nenhuma publicação nova nos canais que você segue.</p>
          )}
          <div className="grid gap-6">
            {data?.channels.map((c) => (
              <section key={c.id} className="grid gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                  {c.name} <span className="font-medium text-muted-foreground">· {c.posts.length}</span>
                </h3>
                <ul className="grid gap-1">
                  {c.posts.map((p) => (
                    <li key={p.id}>
                      <Link href={`/inicio?p=${p.id}`} onClick={close} className="grid gap-0.5 rounded-lg px-3 py-2.5 hover:bg-muted">
                        <span className="flex items-center gap-2 font-semibold">
                          {p.title}
                          {p.hasEvent && <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Tem evento" />}
                          {p.hasPoll && <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Tem enquete" />}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {p.authorName} · {timeAgo(p.createdAt)}
                        </span>
                        {p.excerpt && <span className="line-clamp-2 text-[15px]">{p.excerpt}</span>}
                      </Link>
                    </li>
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
            <Link href="/inicio" onClick={close}>
              Ver na Home
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
