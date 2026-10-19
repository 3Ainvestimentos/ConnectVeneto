"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Cake, CalendarDays, Plane, Plus, TreePalm, Users, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { BIRTHDAYS, UPCOMING_EVENTS } from '@/lib/hub-mock/data';
import { useHubMock } from '@/lib/hub-mock/store';
import { ExampleDataBadge } from './HubPilotGate';
import { PersonAvatar } from './PersonAvatar';
import { TripDialog } from './TripDialog';
import { VacationDialog } from './VacationDialog';
import { overlaps, period, relativeDay, shortDate } from './format';

const DAY = 24 * 60 * 60 * 1000;

function Section({
  icon: Icon,
  title,
  action,
  boxed,
  children,
}: {
  icon: LucideIcon;
  title: string;
  action?: React.ReactNode;
  /** Em colunas (Home): cada seção vira um bloco próprio, com respiro. */
  boxed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={boxed ? 'grid content-start gap-4 rounded-xl border bg-muted/30 p-4' : 'grid gap-3.5 px-5 py-5'}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="inline-flex items-center gap-2 text-base font-semibold">
          <Icon className="h-5 w-5 text-primary" aria-hidden />
          {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  );
}

/** `stacked` (colunas estreitas): a informação da direita desce para uma terceira linha. */
function Row({
  left,
  title,
  subtitle,
  right,
  stacked,
}: {
  left?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <div className={stacked ? 'flex min-w-0 items-start gap-3 text-base' : 'flex min-w-0 items-center gap-3 text-base'}>
      {left}
      <div className="min-w-0 flex-1 leading-snug">
        <div className="truncate font-medium">{title}</div>
        {subtitle && <div className="truncate text-sm text-muted-foreground">{subtitle}</div>}
        {stacked && right && <div className="mt-1 text-sm font-medium tabular-nums text-foreground/80">{right}</div>}
      </div>
      {!stacked && right && <div className="shrink-0 text-sm tabular-nums text-muted-foreground">{right}</div>}
    </div>
  );
}

/** "Ana", "Ana e Bruno", "Ana, Bruno e Carla". */
const joinNames = (names: string[]) => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`);

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;

const ActionLink = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
    <Plus className="h-4 w-4" /> {children}
  </button>
);

/**
 * Pessoas e equipes: o que está acontecendo com os colegas. `stack` empilha viagens, férias, eventos
 * e aniversários; `columns` (Home) põe viagens e férias lado a lado, com uma faixa "Hoje é o
 * aniversário de…" só nos dias em que há aniversariante. Os eventos ficam na Agenda.
 */
export function PeoplePanel({ variant = 'stack' }: { variant?: 'stack' | 'columns' }) {
  const columns = variant === 'columns';
  const { vacations, trips, posts, personById, me, meId } = useHubMock();
  const [tripOpen, setTripOpen] = useState(false);
  const [vacationOpen, setVacationOpen] = useState(false);

  const now = new Date();
  const in14 = new Date(Date.now() + 14 * DAY);
  const in30 = new Date(Date.now() + 30 * DAY);

  const onVacation = vacations.filter((v) => v.status === 'approved' && overlaps(v.start, v.end, now, in14)).slice(0, 3);
  const upcomingTrips = trips.filter((t) => t.personId !== meId && overlaps(t.start, t.end, now, in30)).sort((a, b) => a.start.localeCompare(b.start));
  // Quem vem para a sua cidade aparece primeiro.
  const trips30 = [...upcomingTrips.filter((t) => t.destination === me.city), ...upcomingTrips.filter((t) => t.destination !== me.city)].slice(0, 4);

  const birthdaysToday = BIRTHDAYS.filter((b) => relativeDay(b.date) === 'hoje').map((b) => personById(b.personId));

  const events = [
    ...posts.filter((p) => p.event && new Date(p.event.date) >= now).map((p) => ({ id: p.id, title: p.title, date: p.event!.date, audience: p.event!.audience })),
    ...UPCOMING_EVENTS.filter((e) => !e.postId),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  return (
    <Card className={columns ? 'shadow-sm' : 'divide-y shadow-sm'}>
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="inline-flex items-center gap-2 font-headline text-lg font-semibold">
              <Users className="h-5 w-5 text-primary" aria-hidden /> Pessoas e equipes
            </h3>
            <ExampleDataBadge />
          </div>
          <Link href="/pessoas" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            ver organograma <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className={columns ? 'grid gap-4 px-5 pb-5 md:grid-cols-2' : 'divide-y'}>
        {columns && birthdaysToday.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] p-4 md:col-span-2" role="status">
            <Cake className="h-6 w-6 shrink-0 text-primary" aria-hidden />
            <div className="flex shrink-0 -space-x-2">
              {birthdaysToday.map((p) => (
                <PersonAvatar key={p.id} person={p} size="md" link />
              ))}
            </div>
            <p className="min-w-0 text-base">
              Hoje é o aniversário de <b>{joinNames(birthdaysToday.map((p) => p.name))}</b>! 🎉
            </p>
          </div>
        )}
        <Section boxed={columns} icon={Plane} title="Viagens" action={<ActionLink onClick={() => setTripOpen(true)}>viagem</ActionLink>}>
          {trips30.length === 0 && <Empty>Nenhuma viagem nos próximos 30 dias.</Empty>}
          {trips30.map((t) => {
            const p = personById(t.personId);
            return (
              <Row stacked={columns} key={t.id} left={<PersonAvatar person={p} size="md" link />} title={p.name} subtitle={t.destination} right={period(t.start, t.end)} />
            );
          })}
        </Section>

        <Section boxed={columns} icon={TreePalm} title="Férias" action={<ActionLink onClick={() => setVacationOpen(true)}>férias</ActionLink>}>
          {onVacation.length === 0 && <Empty>Ninguém de férias nas próximas duas semanas.</Empty>}
          {onVacation.map((v) => {
            const p = personById(v.personId);
            const started = new Date(v.start) <= now;
            return (
              <Row
                stacked={columns}
                key={v.id}
                left={<PersonAvatar person={p} size="md" link />}
                title={p.name}
                subtitle={`${p.area} · ${p.city}`}
                right={started ? `volta ${shortDate(new Date(new Date(v.end).getTime() + DAY).toISOString())}` : `a partir de ${shortDate(v.start)}`}
              />
            );
          })}
        </Section>

        {!columns && (
          <Section icon={CalendarDays} title="Eventos">
            {events.length === 0 && <Empty>Nenhum evento marcado.</Empty>}
            {events.map((e) => (
              <Row
                key={e.id}
                title={e.title}
                subtitle={relativeDay(e.date)}
                right={
                  <span className={e.audience === 'Clientes' ? 'rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-200' : 'rounded bg-muted px-2 py-0.5 text-xs font-semibold'}>
                    {e.audience}
                  </span>
                }
              />
            ))}
          </Section>
        )}

        {!columns && (
          <Section icon={Cake} title="Aniversários">
            {BIRTHDAYS.map((b) => {
              const p = personById(b.personId);
              const today = relativeDay(b.date) === 'hoje';
              return (
                <Row
                  key={b.personId}
                  left={<PersonAvatar person={p} size="md" link />}
                  title={p.name}
                  subtitle={p.area}
                  right={today ? <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">hoje</span> : shortDate(b.date)}
                />
              );
            })}
          </Section>
        )}
      </div>

      <TripDialog open={tripOpen} onOpenChange={setTripOpen} />
      <VacationDialog open={vacationOpen} onOpenChange={setVacationOpen} />
    </Card>
  );
}
