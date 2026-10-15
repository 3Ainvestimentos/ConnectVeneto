const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (diff < MINUTE) return 'agora';
  if (diff < HOUR) return `há ${Math.round(diff / MINUTE)} min`;
  if (diff < DAY) return `há ${Math.round(diff / HOUR)} h`;
  if (diff < 2 * DAY) return 'ontem';
  return `há ${Math.round(diff / DAY)} dias`;
}

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export const weekdayDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

export function period(start: string, end: string): string {
  const a = shortDate(start);
  const b = shortDate(end);
  return a === b ? a : `${a} a ${b}`;
}

/** "hoje", "amanhã" ou a data curta. */
export function relativeDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(now)) / DAY);
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  return shortDate(iso);
}

/** Converte ISO para o valor de um <input type="date">. */
export const toDateInput = (iso: string) => iso.slice(0, 10);
/** Converte o valor de um <input type="date"> para ISO ao meio-dia local (evita virar o dia por fuso). */
export const fromDateInput = (value: string) => new Date(`${value}T12:00:00`).toISOString();

export function overlaps(start: string, end: string, from: Date, to: Date): boolean {
  return new Date(start) <= to && new Date(end) >= from;
}
