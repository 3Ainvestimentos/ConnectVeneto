
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

declare global {
    interface Window {
        gapi: {
          load: (api: string, callback: () => void) => void;
          client: {
            init: (config: {
              apiKey: string | undefined;
              discoveryDocs: string[];
            }) => Promise<void>;
            setToken: (token: { access_token: string }) => void;
            calendar: {
              events: {
                list: (params: Record<string, string | boolean>) => Promise<{
                  result?: { items?: CalendarEvent[] };
                }>;
              };
            };
          };
        };
    }
}

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
  attendees?: { email: string, displayName?: string, responseStatus: string }[];
  hangoutLink?: string;
  location?: string;
}

/**
 * Normalizes a date string from Google Calendar API into a correct Date object,
 * handling the "all-day" event timezone issue by setting the time to midday.
 * @param dateStr The date string from the event (e.g., '2025-08-19' or '2025-08-19T10:00:00-03:00').
 * @returns A JavaScript Date object.
 */
const normalizeDate = (dateStr: string): Date => {
  // If the string does not contain 'T', it's an "all-day" event date like 'YYYY-MM-DD'.
  // Appending T12:00:00 makes it unambiguous and avoids timezone-related day shifts.
  if (dateStr && !dateStr.includes('T')) {
    return parseISO(`${dateStr}T12:00:00`);
  }
  // For datetime strings, parseISO handles them correctly.
  return parseISO(dateStr);
};


export default function GoogleCalendar() {
  const { user, accessToken, signOut } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const listMonthEvents = useCallback(async (month: Date) => {
    if (!user || !accessToken) {
      throw new Error("Usuário não autenticado ou token de acesso inválido.");
    }
    
    window.gapi.client.setToken({ access_token: accessToken });
    
    const timeMin = startOfMonth(month).toISOString();
    const timeMax = endOfMonth(month).toISOString();

    const response = await window.gapi.client.calendar.events.list({
      'calendarId': 'primary',
      'timeMin': timeMin,
      'timeMax': timeMax,
      'showDeleted': false,
      'singleEvents': true,
      'orderBy': 'startTime'
    });

    if (!response || !response.result) {
        throw new Error("A resposta da API do Google Calendar foi inválida ou nula.");
    }

    setEvents(response.result.items || []);
    setError(null);

  }, [user, accessToken]);

  const initializeGapiClient = useCallback(async () => {
    try {
        if (typeof window.gapi !== 'undefined' && typeof window.gapi.load !== 'undefined') {
            await new Promise<void>((resolve, reject) => {
                window.gapi.load('client', () => {
                    window.gapi.client.init({
                        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
                        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
                    }).then(() => resolve(), (err: unknown) => reject(err));
                });
            });
            await listMonthEvents(currentMonth);
        } else {
            throw new Error("Não foi possível carregar a API do Google. Verifique sua conexão ou tente fazer login novamente.");
        }
    } catch (e: unknown) {
        console.error("Erro ao inicializar ou buscar eventos:", e);
        setError("Falha ao carregar os eventos. Por favor, saia e faça login novamente para reautenticar.");
    }
  }, [listMonthEvents, currentMonth]);


  useEffect(() => {
    if (user && accessToken) {
        initializeGapiClient();
    } else if (user && !accessToken) {
        setError("Sua sessão de acesso ao Google Calendar expirou. Faça login novamente para reautenticar.");
    } else if (!user) {
        setError("Usuário não autenticado.");
    }
  }, [user, accessToken, initializeGapiClient]); 

  const handleDayClick = (day: Date | undefined) => {
    if(day) {
        setSelectedDate(day);
    }
  };

  const handleMonthChange = (month: Date) => {
      setCurrentMonth(month);
      listMonthEvents(month).catch(err => {
          console.error("Failed to fetch events on month change:", err);
          setError("Falha ao buscar eventos do novo mês. Por favor, tente novamente.");
      });
  };
  
  const eventDates = useMemo(() => events.map(e => normalizeDate(e.start.dateTime || e.start.date)), [events]);
  
  const eventsForSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter(e => isSameDay(normalizeDate(e.start.dateTime || e.start.date), selectedDate));
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
                    <li key={event.id} className="flex items-center gap-3 text-sm p-2 rounded-md hover:bg-muted cursor-pointer" onClick={() => setSelectedEvent(event)}>
                        <div className={cn("font-semibold text-foreground w-24 flex-shrink-0 text-center", isAllDay && 'text-muted-foreground')}>
                            {timeFormat}
                        </div>
                        <div className="flex-grow border-l-2 border-border pl-3 truncate">
                            <p className="font-semibold truncate">{event.summary}</p>
                        </div>
                    </li>
                );
            })}
            </ul>
        )
    }
    
    return <p className="text-center text-muted-foreground text-sm py-4">Nenhum evento para este dia.</p>;
  }

  return (
    <>
        <Card className="shadow-sm flex flex-col h-full">
            <CardHeader>
                <CardTitle className="font-headline text-foreground text-xl">Google Calendar</CardTitle>
                <CardDescription>Visualize seus próximos compromissos e eventos.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col gap-4 overflow-hidden">
              {error ? (
                <div className="flex flex-col items-center justify-center text-center text-destructive p-4 h-full">
                    <AlertCircle className="h-8 w-8 mb-2" />
                    <p className="font-semibold">Falha ao carregar</p>
                    <p className="text-sm">{error}</p>
                    <Button variant="destructive" size="sm" onClick={signOut} className="mt-2 text-xs">Fazer Login Novamente</Button>
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
                        />
                    </div>
                    <div className="flex-grow flex flex-col min-h-0">
                        <h3 className="text-sm font-semibold mb-2 flex-shrink-0">
                            Eventos de {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'hoje'}
                        </h3>
                        <div className="flex-grow relative">
                            <ScrollArea className="absolute inset-0">
                                {renderEvents()}
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
