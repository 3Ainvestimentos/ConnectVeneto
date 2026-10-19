/** Janela de datas da Agenda da Home: eventos cujo início cai no intervalo. */

export interface DateRange {
  from: Date;
  to: Date;
}

interface Dated {
  event?: { start: string } | null;
  poll?: { closesAt: string } | null;
}

/** Data que conta: início do evento ou, sem evento, encerramento da enquete. */
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
