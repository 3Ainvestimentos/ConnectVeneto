/**
 * Janela de tempo do filtro "Acontece em": eventos (pela data do evento) e enquetes (pelo
 * encerramento) que caem no período. A semana começa na segunda-feira.
 */
import { addMonths, addWeeks, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';

export const PERIODS = [
  { id: 'all', label: 'Próximos' },
  { id: 'this-week', label: 'Esta semana' },
  { id: 'next-week', label: 'Próxima semana' },
  { id: 'this-month', label: 'Este mês' },
  { id: 'next-month', label: 'Próximo mês' },
] as const;

export type Period = (typeof PERIODS)[number]['id'];

export interface DateRange {
  from: Date;
  to: Date;
}

const WEEK = { weekStartsOn: 1 } as const;

export function periodRange(period: Exclude<Period, 'all'>, now = new Date()): DateRange {
  switch (period) {
    case 'this-week':
      return { from: startOfWeek(now, WEEK), to: endOfWeek(now, WEEK) };
    case 'next-week': {
      const next = addWeeks(now, 1);
      return { from: startOfWeek(next, WEEK), to: endOfWeek(next, WEEK) };
    }
    case 'this-month':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'next-month': {
      const next = addMonths(now, 1);
      return { from: startOfMonth(next), to: endOfMonth(next) };
    }
  }
}

interface Dated {
  event?: { start: string } | null;
  poll?: { closesAt: string } | null;
}

/** Data que o filtro usa: início do evento ou, sem evento, encerramento da enquete. */
export function happeningAt(post: Dated): Date | null {
  const iso = post.event?.start ?? post.poll?.closesAt;
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function happensIn(post: Dated, range: DateRange): boolean {
  const at = happeningAt(post);
  return !!at && at >= range.from && at <= range.to;
}
