"use client";

import { useMemo, useState } from 'react';
import { CalendarCheck, CalendarDays, Megaphone, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GoogleEventDetailsModal } from '@/components/dashboard-v2/GoogleEventDetailsModal';
import type { CalendarEvent } from '@/components/dashboard-v2/GoogleCalendar';
import { useCompanyCalendar } from '@/hooks/useCompanyCalendar';
import { useHubFeed } from '@/hooks/useHubFeed';
import { calendarStart, type CalendarItem } from '@/lib/calendar/types';
import { happensIn, type DateRange } from '@/lib/hub/periods';
import { NewPostDialog } from './NewPostDialog';
import { PostDialog } from './PostDialog';

const DAY = 24 * 60 * 60 * 1000;
const VISIBLE = 6;

/** Janelas do seletor da Agenda; o padrão são os próximos 60 dias. */
const WINDOWS = [
  { id: '7', label: 'Próximos 7 dias', empty: 'nos próximos 7 dias' },
  { id: '30', label: 'Próximos 30 dias', empty: 'nos próximos 30 dias' },
  { id: '60', label: 'Próximos 60 dias', empty: 'nos próximos 60 dias' },
  { id: '90', label: 'Próximos 90 dias', empty: 'nos próximos 90 dias' },
  { id: 'this-month', label: 'Este mês', empty: 'neste mês' },
  { id: 'next-month', label: 'Próximo mês', empty: 'no próximo mês' },
] as const;
type WindowId = (typeof WINDOWS)[number]['id'];

function windowRange(id: WindowId): DateRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (id === 'this-month') return { from: today, to: new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59) };
  if (id === 'next-month') {
    return { from: new Date(today.getFullYear(), today.getMonth() + 1, 1), to: new Date(today.getFullYear(), today.getMonth() + 2, 0, 23, 59, 59) };
  }
  return { from: today, to: new Date(today.getTime() + Number(id) * DAY) };
}

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
 * Agenda e Eventos da Home: eventos publicados no hub (com presença) e o Google Agenda da Vêneto,
 * juntos e por data, na janela escolhida. Evento importado do Google para uma publicação aparece uma
 * vez só, como publicação.
 */
export function AgendaCard() {
  const { data } = useHubFeed();
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [openCalendar, setOpenCalendar] = useState<CalendarItem | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [windowId, setWindowId] = useState<WindowId>('60');
  const [newOpen, setNewOpen] = useState(false);
  const canPublish = !!data?.channels.some((c) => c.canPublish);
  const current = WINDOWS.find((w) => w.id === windowId)!;

  const range = useMemo(() => windowRange(windowId), [windowId]);
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
          <CalendarDays className="h-5 w-5 text-primary" aria-hidden /> Agenda e Eventos
        </h2>
        <div className="flex items-center gap-2">
        {canPublish && (
          <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Novo evento
          </Button>
        )}
        <Select
          value={windowId}
          onValueChange={(v) => {
            setWindowId(v as WindowId);
            setShowAll(false);
          }}
        >
          <SelectTrigger className="h-9 w-auto gap-2 text-sm" aria-label="Período da agenda">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {WINDOWS.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>
      </div>
      <div className="px-5 pb-5 pt-4">
        {data && entries.length === 0 && !calendar.isLoading && (
          <p className="text-base text-muted-foreground">Nenhum evento {current.empty}.</p>
        )}
        <ul className="grid gap-1">
          {visible.map((e) => (
            <li key={e.key}>
              <button
                type="button"
                onClick={() => (e.source === 'post' ? setOpenPost(e.postId) : setOpenCalendar(e.item))}
                className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-lg p-2 text-left hover:bg-muted"
              >
                <DateTile date={e.start} />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="line-clamp-2 text-base font-semibold leading-snug">{e.title}</span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
                    {e.source === 'post' ? (
                      <Megaphone className="h-3.5 w-3.5 shrink-0" aria-label="Publicação" />
                    ) : (
                      <CalendarCheck className="h-3.5 w-3.5 shrink-0" aria-label="Agenda da Vêneto" />
                    )}
                    <span className="capitalize">{e.start.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">{e.allDay ? 'dia todo' : fmtTime(e.start)}</span>
                    {e.audience === 'Clientes' && (
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-200">Para clientes</span>
                    )}
                  </span>
                  {e.place && <span className="truncate text-sm text-muted-foreground">{e.place}</span>}
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
      {canPublish && data && <NewPostDialog open={newOpen} onOpenChange={setNewOpen} channels={data.channels} viewer={data.viewer} kind="evento" />}
      <GoogleEventDetailsModal
        isOpen={!!openCalendar}
        onClose={() => setOpenCalendar(null)}
        // O modal usa o tipo do widget antigo (start/end obrigatórios); preenche o que falta.
        event={openCalendar ? ({ ...openCalendar, end: openCalendar.end ?? openCalendar.start } as unknown as CalendarEvent) : null}
      />
    </Card>
  );
}
