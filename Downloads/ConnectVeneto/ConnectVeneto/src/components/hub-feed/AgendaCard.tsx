"use client";

import { useMemo, useState } from 'react';
import { CalendarCheck, CalendarDays, Megaphone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { GoogleEventDetailsModal } from '@/components/dashboard-v2/GoogleEventDetailsModal';
import type { CalendarEvent } from '@/components/dashboard-v2/GoogleCalendar';
import { useCompanyCalendar } from '@/hooks/useCompanyCalendar';
import { useHubFeed } from '@/hooks/useHubFeed';
import { calendarStart, type CalendarItem } from '@/lib/calendar/types';
import { happensIn, type DateRange } from '@/lib/hub/periods';
import { PostDialog } from './PostDialog';

const DAY = 24 * 60 * 60 * 1000;
/** A Agenda mostra os próximos 60 dias. */
const DEFAULT_DAYS = 60;
const VISIBLE = 6;

type AgendaEntry = {
  key: string;
  start: Date;
  allDay: boolean;
  title: string;
  place?: string;
  audience?: 'Interno' | 'Clientes';
} & ({ source: 'post'; postId: string } | { source: 'calendar'; item: CalendarItem });

const fmtTime = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function DateTile({ date }: { date: Date }) {
  return (
    <div className="w-14 shrink-0 rounded-lg border bg-card py-1 text-center">
      <div className="font-headline text-xl font-bold leading-tight">{date.getDate()}</div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</div>
    </div>
  );
}

/**
 * Agenda da Home: eventos publicados no hub (com presença) e o Google Agenda da Vêneto, juntos e
 * por data. Evento importado do Google para uma publicação aparece uma vez só, como publicação.
 */
export function AgendaCard() {
  const { data } = useHubFeed();
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [openCalendar, setOpenCalendar] = useState<CalendarItem | null>(null);
  const [showAll, setShowAll] = useState(false);

  const range: DateRange = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    return { from, to: new Date(from.getTime() + DEFAULT_DAYS * DAY) };
  }, []);
  const calendar = useCompanyCalendar(range.from, range.to);

  const entries = useMemo(() => {
    const posts = (data?.posts ?? []).filter((p) => p.event && happensIn({ event: p.event }, range));
    const imported = new Set(posts.map((p) => p.event!.calendarEventId).filter(Boolean));
    const fromPosts: AgendaEntry[] = posts.map((p) => ({
      key: `post-${p.id}`,
      source: 'post',
      postId: p.id,
      start: new Date(p.event!.start),
      allDay: false,
      title: p.title,
      place: p.event!.place,
      audience: p.event!.audience,
    }));
    const fromCalendar: AgendaEntry[] = (calendar.data ?? [])
      .filter((it) => !imported.has(it.id))
      .flatMap((it) => {
        const start = calendarStart(it);
        if (!start || start < range.from || start > range.to) return [];
        return [{ key: `cal-${it.id}`, source: 'calendar' as const, item: it, start, allDay: !it.start.dateTime, title: it.summary || 'Evento', place: it.location }];
      });
    return [...fromPosts, ...fromCalendar].sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [data, calendar.data, range]);

  const visible = showAll ? entries : entries.slice(0, VISIBLE);

  return (
    <Card className="shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <h2 className="inline-flex items-center gap-2 font-headline text-lg font-semibold">
          <CalendarDays className="h-5 w-5 text-primary" aria-hidden /> Agenda
        </h2>
        <span className="text-sm text-muted-foreground">próximos 60 dias</span>
      </div>
      <div className="px-5 pb-5 pt-4">
        {data && entries.length === 0 && !calendar.isLoading && (
          <p className="text-base text-muted-foreground">Nenhum evento nos próximos 60 dias.</p>
        )}
        <ul className="grid gap-1">
          {visible.map((e) => (
            <li key={e.key}>
              <button
                type="button"
                onClick={() => (e.source === 'post' ? setOpenPost(e.postId) : setOpenCalendar(e.item))}
                className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-4 rounded-lg p-2 text-left hover:bg-muted"
              >
                <DateTile date={e.start} />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-base font-semibold">{e.title}</span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                    <span className="capitalize">{e.start.toLocaleDateString('pt-BR', { weekday: 'long' })}</span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">{e.allDay ? 'dia todo' : fmtTime(e.start)}</span>
                    {e.place && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate">{e.place}</span>
                      </>
                    )}
                  </span>
                </span>
                <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                  {e.audience === 'Clientes' && (
                    <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-200">Para clientes</span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {e.source === 'post' ? (
                      <>
                        <Megaphone className="h-3.5 w-3.5" aria-hidden /> Publicação
                      </>
                    ) : (
                      <>
                        <CalendarCheck className="h-3.5 w-3.5" aria-hidden /> Agenda da Vêneto
                      </>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {entries.length > VISIBLE && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-sm font-medium text-primary hover:underline">
            {showAll ? 'mostrar menos' : `mostrar todos (${entries.length})`}
          </button>
        )}
      </div>
      <PostDialog postId={openPost} onOpenChange={(o) => !o && setOpenPost(null)} />
      <GoogleEventDetailsModal
        isOpen={!!openCalendar}
        onClose={() => setOpenCalendar(null)}
        // O modal usa o tipo do widget antigo (start/end obrigatórios); preenche o que falta.
        event={openCalendar ? ({ ...openCalendar, end: openCalendar.end ?? openCalendar.start } as unknown as CalendarEvent) : null}
      />
    </Card>
  );
}
