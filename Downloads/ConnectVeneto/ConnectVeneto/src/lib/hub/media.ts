import type { HubEvent, HubVideo } from './model';

const HOUR = 60 * 60 * 1000;

/** Data no formato do Google Agenda (UTC, sem separadores): 20261024T120000Z. */
const gcalDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * Link "Adicionar ao Google Agenda" (template do Google; funciona sem API nem login extra).
 * Abre a agenda da própria pessoa com o evento preenchido.
 */
export function googleCalendarUrl(title: string, event: Pick<HubEvent, 'start' | 'end' | 'place'>, details?: string): string {
  const end = event.end ?? new Date(new Date(event.start).getTime() + HOUR).toISOString();
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${gcalDate(event.start)}/${gcalDate(end)}`,
    location: event.place,
    details: details ?? '',
    ctz: 'America/Sao_Paulo',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Reconhece o link colado e devolve como o vídeo deve ser exibido. */
export function parseVideoUrl(raw: string): HubVideo | null {
  const url = raw.trim();
  if (!/^https?:\/\//i.test(url)) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i);
  if (yt) return { kind: 'youtube', url: `https://www.youtube.com/embed/${yt[1]}` };
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/i);
  if (drive) return { kind: 'drive', url: `https://drive.google.com/file/d/${drive[1]}/preview` };
  return { kind: 'link', url };
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
