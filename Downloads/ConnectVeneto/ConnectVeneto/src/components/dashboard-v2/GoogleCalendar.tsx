
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '../ui/calendar';
import { ScrollArea } from '../ui/scroll-area';
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

/**
 * Normalizes a date string from Google Calendar API into a correct Date object,
 * handling the "all-day" event timezone issue by setting the time to midday.
 */
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

  const eventDates = useMemo(() => events.map((e) => normalizeDate(e.start.dateTime || e.start.date)), [events]);

  const eventsForSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((e) =>
      isSameDay(normalizeDate(e.start.dateTime || e.start.date), selectedDate)
    );
  }, [events, selectedDate]);

  const renderEvents = () => {
    if (eventsForSelectedDay.length > 0) {
      return (
        <ul className="space-y-2 pr-4">
          {eventsForSelectedDay.map((event) => {
            const startDate = normalizeDate(event.start.dateTime || event.start.date);
            const endDate = normalizeDate(event.end.dateTime || event.end.date);
            const isAllDay = !event.start.dateTime;

            const timeFormat = isAllDay
              ? 'Dia todo'
              : `${format(startDate, 'HH:mm')} - ${format(endDate, 'HH:mm')}`;

            return (
              <li
                key={event.id}
                className="flex items-center gap-3 text-sm p-2 rounded-md hover:bg-muted cursor-pointer"
                onClick={() => setSelectedEvent(event)}
              >
                <div
                  className={cn(
                    'font-semibold text-foreground w-24 flex-shrink-0 text-center',
                    isAllDay && 'text-muted-foreground'
                  )}
                >
                  {timeFormat}
                </div>
                <div className="flex-grow border-l-2 border-border pl-3 truncate">
                  <p className="font-semibold truncate">{event.summary}</p>
                </div>
              </li>
            );
          })}
        </ul>
      );
    }

    return (
      <p className="text-center text-muted-foreground text-sm py-4">
        Nenhum evento para este dia.
      </p>
    );
  };

  return (
    <>
      <Card className="shadow-sm flex flex-col h-full">
        <CardHeader>
          <CardTitle className="font-headline text-foreground text-xl">Agenda</CardTitle>
          <CardDescription>
            Compromissos e eventos da agenda institucional (calendário público).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col gap-4 overflow-hidden">
          {error ? (
            <div className="flex flex-col items-center justify-center text-center text-destructive p-4 h-full">
              <AlertCircle className="h-8 w-8 mb-2" />
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
            <>
              <div className="flex justify-center">
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
              <div className="flex-grow flex flex-col min-h-0">
                <h3 className="text-sm font-semibold mb-2 flex-shrink-0">
                  Eventos de {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'hoje'}
                </h3>
                <div className="flex-grow relative">
                  <ScrollArea className="absolute inset-0">
                    {loading ? (
                      <p className="text-center text-muted-foreground text-sm py-4">
                        Carregando eventos…
                      </p>
                    ) : (
                      renderEvents()
                    )}
                  </ScrollArea>
                </div>
              </div>
            </>
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
