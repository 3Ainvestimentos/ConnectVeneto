"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '../ui/calendar';
import { GoogleEventDetailsModal } from './GoogleEventDetailsModal';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from '@/lib/firebase';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    date: string;
  };
  end: {
    dateTime: string;
    date: string;
  };
  attendees?: { email: string; displayName?: string; responseStatus: string }[];
  hangoutLink?: string;
  location?: string;
}

const normalizeDate = (dateStr: string): Date => {
  if (dateStr && !dateStr.includes('T')) {
    return parseISO(`${dateStr}T12:00:00`);
  }
  return parseISO(dateStr);
};

export default function GoogleCalendar() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(false);

  const listMonthEvents = useCallback(async (month: Date) => {
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    const auth = getAuth(getFirebaseApp());
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      throw new Error('Não foi possível validar a sessão para carregar a agenda.');
    }

    const timeMin = startOfMonth(month).toISOString();
    const timeMax = endOfMonth(month).toISOString();

    const response = await fetch(
      `/api/calendar?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`,
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      }
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg =
        typeof payload?.error === 'string'
          ? payload.error
          : 'Falha ao carregar eventos da agenda.';
      const hint = typeof payload?.hint === 'string' ? ` ${payload.hint}` : '';
      throw new Error(`${msg}${hint}`);
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    setEvents(items as CalendarEvent[]);
    setError(null);
  }, [user]);

  const loadMonth = useCallback(
    async (month: Date) => {
      if (!user) return;
      setLoading(true);
      try {
        await listMonthEvents(month);
      } catch (e: unknown) {
        console.error('Erro ao buscar eventos da agenda:', e);
        setError(e instanceof Error ? e.message : 'Falha ao carregar a agenda.');
      } finally {
        setLoading(false);
      }
    },
    [user, listMonthEvents]
  );

  useEffect(() => {
    if (user) {
      loadMonth(currentMonth);
    } else {
      setError('Usuário não autenticado.');
    }
  }, [user, currentMonth, loadMonth]);

  const handleDayClick = (day: Date | undefined) => {
    if (day) {
      setSelectedDate(day);
    }
  };

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
  };

  const eventDates = useMemo(
    () => events.map((event) => normalizeDate(event.start.dateTime || event.start.date)),
    [events]
  );

  const eventsForSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((event) =>
      isSameDay(normalizeDate(event.start.dateTime || event.start.date), selectedDate)
    );
  }, [events, selectedDate]);

  /** Eventos do mês carregado que não caem no dia selecionado (para a seção "Eventos do Mês"). */
  const eventsInMonthNotOnSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter(
      (event) =>
        !isSameDay(normalizeDate(event.start.dateTime || event.start.date), selectedDate)
    );
  }, [events, selectedDate]);

  const renderEventList = (items: CalendarEvent[], emptyMessage: string) => {
    if (items.length === 0) {
      return <p className="py-4 text-sm text-muted-foreground">{emptyMessage}</p>;
    }

    return (
      <ul className="space-y-2 pr-4">
        {items.map((event) => {
          const startDate = normalizeDate(event.start.dateTime || event.start.date);
          const endDate = normalizeDate(event.end.dateTime || event.end.date);
          const isAllDay = !event.start.dateTime;
          const showDate = !selectedDate || !isSameDay(startDate, selectedDate);

          const timeFormat = isAllDay
            ? 'Dia todo'
            : `${format(startDate, 'HH:mm')} - ${format(endDate, 'HH:mm')}`;

          return (
            <li
              key={event.id}
              className="flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm transition-colors hover:bg-muted"
              onClick={() => setSelectedEvent(event)}
            >
              <div
                className={cn(
                  'w-24 flex-shrink-0 text-center font-semibold text-foreground',
                  isAllDay && 'text-muted-foreground'
                )}
              >
                {timeFormat}
              </div>
              <div className="min-w-0 flex-grow border-l-2 border-border pl-3">
                <p className="truncate font-semibold">{event.summary}</p>
                {showDate ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {format(startDate, "dd 'de' MMMM", { locale: ptBR })}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <>
      <Card className="flex h-full flex-col shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline text-foreground text-xl">Agenda</CardTitle>
          <CardDescription>
            Compromissos e eventos da agenda institucional (calendário público).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-grow flex-col gap-4 overflow-hidden">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center text-destructive">
              <AlertCircle className="mb-2 h-8 w-8" />
              <p className="font-semibold">Falha ao carregar</p>
              <p className="text-sm">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => loadMonth(currentMonth)}
              >
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="grid min-h-[280px] flex-grow gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-stretch">
              <div className="flex justify-center self-start lg:justify-start">
                <div className="w-fit max-w-full shrink-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDayClick}
                    month={currentMonth}
                    onMonthChange={handleMonthChange}
                    className="rounded-md border"
                    modifiers={{ event: eventDates }}
                    modifiersClassNames={{
                      event: 'bg-muted rounded-full',
                      today: 'bg-muted-foreground/40 text-foreground font-bold',
                    }}
                    locale={ptBR}
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="flex h-full min-h-[240px] flex-col rounded-lg border border-border/60 bg-background p-4">
                <div className="mb-3 flex-shrink-0">
                  <h3 className="text-sm font-semibold text-foreground">
                    Eventos de {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'hoje'}
                  </h3>
                  {eventsForSelectedDay.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {eventsForSelectedDay.length} compromisso(s) no dia selecionado.
                    </p>
                  ) : null}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                  {loading ? (
                    <p className="py-4 text-sm text-muted-foreground">
                      Carregando eventos...
                    </p>
                  ) : eventsForSelectedDay.length > 0 ? (
                    renderEventList(eventsForSelectedDay, 'Nenhum evento para este dia.')
                  ) : (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Nenhum evento para este dia.
                      </p>
                      {eventsInMonthNotOnSelectedDay.length > 0 ? (
                        <>
                          <div
                            className="my-4 border-t border-border"
                            role="separator"
                            aria-hidden="true"
                          />
                          <h4 className="mb-2 text-sm font-semibold text-foreground">
                            Eventos do Mês
                          </h4>
                          {renderEventList(eventsInMonthNotOnSelectedDay, '')}
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <GoogleEventDetailsModal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
      />
    </>
  );
}
