/**
 * Evento do Google Agenda da Vêneto como `/api/calendar` devolve. Evento de dia inteiro só tem
 * `date` (AAAA-MM-DD); os demais têm `dateTime`.
 */
export interface CalendarItem {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  start: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; responseStatus: string }[];
}

/** Início do evento como Date; dia inteiro vira meio-dia local (evita trocar de dia pelo fuso). */
export function calendarStart(item: CalendarItem): Date | null {
  const raw = item.start.dateTime ?? (item.start.date ? `${item.start.date}T12:00:00` : null);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
