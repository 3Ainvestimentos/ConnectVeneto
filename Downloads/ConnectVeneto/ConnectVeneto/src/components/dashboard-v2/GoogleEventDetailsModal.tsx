
"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CalendarEvent } from './GoogleCalendar';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, AlignLeft, Video, MapPin, Users, User, Check, HelpCircle, X, ExternalLink } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface GoogleEventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
}

const getAttendeeIcon = (status: string) => {
    switch(status) {
        case 'accepted': return <Check className="h-4 w-4 text-green-500" />;
        case 'tentative': return <HelpCircle className="h-4 w-4 text-yellow-500" />;
        case 'declined': return <X className="h-4 w-4 text-red-500" />;
        default: return <User className="h-4 w-4 text-muted-foreground" />;
    }
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


export function GoogleEventDetailsModal({ isOpen, onClose, event }: GoogleEventDetailsModalProps) {
  if (!isOpen || !event) {
    return null;
  }

  const startDate = normalizeDate(event.start.dateTime || event.start.date);
  const endDate = normalizeDate(event.end.dateTime || event.end.date);
  const isAllDay = !event.start.dateTime;

  const formattedDate = format(startDate, 'PPPP', { locale: ptBR });
  const formattedTime = isAllDay ? 'Dia todo' : `${format(startDate, 'HH:mm')} - ${format(endDate, 'HH:mm')}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-start gap-3">
             <Calendar className="h-6 w-6 mt-1 text-muted-foreground" />
             <span>{event.summary}</span>
          </DialogTitle>
          <DialogDescription>Detalhes do evento do Google Calendar.</DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-4">
                <div className="flex items-center gap-3 text-sm">
                    <Clock className="h-5 w-5 text-muted-foreground"/>
                    <div>
                        <p className="font-semibold">{formattedDate}</p>
                        <p className="text-muted-foreground">{formattedTime}</p>
                    </div>
                </div>

                {event.location && (
                    <div className="flex items-center gap-3 text-sm">
                        <MapPin className="h-5 w-5 text-muted-foreground"/>
                        <p>{event.location}</p>
                    </div>
                )}
                
                {event.hangoutLink && (
                     <Button asChild className="w-full bg-success hover:bg-success/90 text-success-foreground">
                        <a href={event.hangoutLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                            <Video className="h-4 w-4"/>
                            Entrar na videoconferência
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </Button>
                )}
                
                {event.description && (
                     <>
                        <Separator />
                        <div className="flex items-start gap-3 text-sm">
                            <AlignLeft className="h-5 w-5 text-muted-foreground mt-0.5"/>
                            <div className="whitespace-pre-wrap font-body text-foreground">{event.description}</div>
                        </div>
                    </>
                )}

                {event.attendees && event.attendees.length > 0 && (
                    <>
                        <Separator />
                        <div>
                            <h3 className="font-semibold mb-2 flex items-center gap-2"><Users className="h-5 w-5 text-muted-foreground" /> Participantes ({event.attendees.length})</h3>
                            <div className="space-y-2">
                                {event.attendees.map(attendee => (
                                    <div key={attendee.email} className="flex items-center justify-between text-sm">
                                        <p className="truncate">{attendee.displayName || attendee.email}</p>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    {getAttendeeIcon(attendee.responseStatus)}
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="capitalize">{attendee.responseStatus}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
