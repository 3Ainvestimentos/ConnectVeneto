
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEvents } from '@/contexts/EventsContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCollaboratorUserId, useCollaborators } from '@/contexts/CollaboratorsContext';
import { isSameMonth, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
import { getIcon } from '@/lib/icons';
import type { LucideIcon } from 'lucide-react';
import { findCollaboratorByEmail } from '@/lib/email-utils';

export default function InternalCalendar() {
  const [displayedMonth, setDisplayedMonth] = useState<Date>(new Date());

  const { user } = useAuth();
  const { collaborators } = useCollaborators();
  const { events, getEventRecipients } = useEvents();

  const currentUserCollab = useMemo(() => {
    if (!user || !collaborators) return null;
    return findCollaboratorByEmail(collaborators, user.email) || null;
  }, [user, collaborators]);

  const userEvents = useMemo(() => {
    if (!currentUserCollab) return [];
    return events.filter(event => {
      const recipients = getEventRecipients(event, collaborators);
      return recipients.some(r => getCollaboratorUserId(r) === getCollaboratorUserId(currentUserCollab));
    });
  }, [events, currentUserCollab, collaborators, getEventRecipients]);

  const eventsForMonth = useMemo(() => {
    if (!displayedMonth) return [];
    const timeZone = 'America/Sao_Paulo';
    return userEvents
      .filter(event => {
        const eventDateInSaoPaulo = toZonedTime(parseISO(event.date), timeZone);
        const displayedMonthInSaoPaulo = toZonedTime(displayedMonth, timeZone);
        return isSameMonth(eventDateInSaoPaulo, displayedMonthInSaoPaulo);
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [userEvents, displayedMonth]);

  const eventDates = useMemo(() => userEvents.map(e => toZonedTime(parseISO(e.date), 'UTC')), [userEvents]);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="font-headline text-foreground text-xl flex items-center gap-2">
          Eventos
        </CardTitle>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 lg:grid-cols-1 gap-6">
        <div className="md:col-span-2 lg:col-span-1 flex items-start justify-center">
          <Calendar
            mode="single"
            selected={undefined}
            onSelect={undefined}
            className="rounded-md border no-day-hover"
            month={displayedMonth}
            onMonthChange={setDisplayedMonth}
            modifiers={{ event: eventDates }}
            modifiersClassNames={{
              event: 'bg-muted rounded-full',
              today: 'bg-muted-foreground/40 text-foreground rounded-full',
            }}
            locale={ptBR}
          />
        </div>
        <div className="md:col-span-2 lg:col-span-1 relative min-h-[200px]">
          <ScrollArea className="h-full pr-4 absolute inset-0">
            <div className="space-y-4">
              {eventsForMonth.map((event, index) => {
                const Icon = getIcon(event.icon) as LucideIcon;
                return (
                  <div key={index} className="flex items-start gap-4 p-3 bg-muted/40 rounded-lg">
                    <div className="flex-shrink-0 bg-secondary text-secondary-foreground rounded-lg flex items-center justify-center h-10 w-10">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-grow">
                      <p className="font-semibold font-body text-sm text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground font-body flex items-center mt-1">
                        <CalendarDays className="h-3 w-3 mr-1.5" />
                        {new Date(event.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                      </p>
                      <p className="text-xs text-muted-foreground font-body flex items-center mt-1">
                        <Clock className="h-3 w-3 mr-1.5" />
                        {event.time}
                      </p>
                      <p className="text-xs text-muted-foreground font-body flex items-center mt-1">
                        <MapPin className="h-3 w-3 mr-1.5" />
                        {event.location}
                      </p>
                    </div>
                  </div>
                )
              })}
              {eventsForMonth.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <CalendarDays className="h-8 w-8 mb-2" />
                  <p className="font-body text-sm">Nenhum evento para o mês selecionado.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
