"use client";

import { Cake } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { BIRTHDAYS } from '@/lib/hub-mock/data';
import { useHubMock } from '@/lib/hub-mock/store';
import { ExampleDataBadge } from './HubPilotGate';
import { PersonAvatar } from './PersonAvatar';
import { relativeDay, shortDate } from './format';

const DAY = 24 * 60 * 60 * 1000;
/** Mostra os aniversários dos próximos 7 dias; sem nenhum, o card não aparece. */
const WINDOW_DAYS = 7;

/** Aniversários da semana, em card próprio na lateral da Home (some quando não há nenhum). */
export function BirthdaysCard() {
  const { personById } = useHubMock();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = start.getTime() + WINDOW_DAYS * DAY;
  const upcoming = BIRTHDAYS.filter((b) => {
    const t = new Date(b.date).getTime();
    return t >= start.getTime() && t < end;
  }).sort((a, b) => a.date.localeCompare(b.date));

  if (upcoming.length === 0) return null;

  return (
    <Card className="shadow-sm">
      <div className="flex items-center justify-between gap-2 px-5 pt-5">
        <h2 className="inline-flex items-center gap-2 font-headline text-lg font-semibold">
          <Cake className="h-5 w-5 text-primary" aria-hidden /> Aniversários
        </h2>
        <ExampleDataBadge />
      </div>
      <ul className="grid gap-3 px-5 pb-5 pt-4">
        {upcoming.map((b) => {
          const p = personById(b.personId);
          const today = relativeDay(b.date) === 'hoje';
          return (
            <li key={b.personId} className="flex min-w-0 items-center gap-3">
              <PersonAvatar person={p} size="md" link />
              <span className="grid min-w-0 flex-1 leading-snug">
                <span className="truncate text-base font-medium">{p.name}</span>
                <span className="truncate text-sm text-muted-foreground">{p.area}</span>
              </span>
              {today ? (
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold text-primary">hoje 🎉</span>
              ) : (
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {new Date(b.date).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')} {shortDate(b.date)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
