"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Cake, Plane, Plus, TreePalm, Users, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useApprovedVacations, useHubPeople, useHubTrips } from '@/hooks/useHubPeople';
import { isBirthdayOn, normalizeCity, overlapsRange, parseLocalDate } from '@/lib/hub/people';
import { PersonAvatar } from './PersonAvatar';
import { TripDialog } from './TripDialog';
import { initialsOf } from './UserAvatar';

const DAY = 24 * 60 * 60 * 1000;
const MAX_ROWS = 4;

/** "AAAA-MM-DD" → "dd/mm" no fuso local. */
const dm = (iso: string) => parseLocalDate(iso)?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) ?? '';
const span = (a: string, b: string) => (a === b ? dm(a) : `${dm(a)} a ${dm(b)}`);
const dayAfter = (iso: string) => {
  const d = parseLocalDate(iso);
  return d ? new Date(d.getTime() + DAY).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
};

function Section({ icon: Icon, title, action, children }: { icon: LucideIcon; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid content-start gap-4 rounded-xl border bg-muted/30 p-4">
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

function Row({ left, title, subtitle, detail }: { left: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 text-base">
      {left}
      <div className="min-w-0 flex-1 leading-snug">
        <div className="truncate font-medium">{title}</div>
        {subtitle && <div className="truncate text-sm text-muted-foreground">{subtitle}</div>}
        {detail && <div className="mt-1 text-sm font-medium tabular-nums text-foreground/80">{detail}</div>}
      </div>
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;

/** Avatar quando a pessoa da viagem não foi achada no cadastro (nome digitado no admin). */
const NameAvatar = ({ name }: { name: string }) => (
  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-500 font-headline text-sm font-bold text-white">{initialsOf(name)}</span>
);

/** "Ana", "Ana e Bruno", "Ana, Bruno e Carla". */
const joinNames = (names: string[]) => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`);

/**
 * Pessoas e equipes na Home: aniversariantes do dia (faixa, só quando há), viagens dos colegas nos
 * próximos 30 dias (quem vem para a sua cidade primeiro) e férias aprovadas nas próximas 2 semanas.
 */
export function PeoplePanel() {
  const { user, permissions } = useAuth();
  const { people, me } = useHubPeople();
  const { trips } = useHubTrips();
  const { vacations } = useApprovedVacations();
  const [tripOpen, setTripOpen] = useState(false);

  const now = new Date();
  const in14 = new Date(now.getTime() + 14 * DAY);
  const in30 = new Date(now.getTime() + 30 * DAY);

  const birthdaysToday = people.filter((p) => isBirthdayOn(p.birthDate, now));

  const upcomingTrips = trips
    .filter((t) => t.responsavelUid !== user?.uid && t.person?.id !== me?.id && overlapsRange(t.startDate, t.endDate, now, in30))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const myCity = normalizeCity(me?.city);
  const tripsShown = [
    ...upcomingTrips.filter((t) => myCity && normalizeCity(t.destinationBranch) === myCity),
    ...upcomingTrips.filter((t) => !myCity || normalizeCity(t.destinationBranch) !== myCity),
  ].slice(0, MAX_ROWS);

  const away = vacations
    .filter((v) => overlapsRange(v.startDate, v.endDate, now, in14))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, MAX_ROWS);

  return (
    <Card className="shadow-sm">
      <div className="flex items-center justify-between gap-2 px-5 pb-4 pt-5">
        <h3 className="inline-flex items-center gap-2 font-headline text-lg font-semibold">
          <Users className="h-5 w-5 text-primary" aria-hidden /> Pessoas e equipes
        </h3>
        <Link href="/pessoas" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          ver organograma <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 px-5 pb-5 md:grid-cols-2">
        {birthdaysToday.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] p-4 md:col-span-2" role="status">
            <Cake className="h-6 w-6 shrink-0 text-primary" aria-hidden />
            <div className="flex shrink-0 -space-x-2">
              {birthdaysToday.slice(0, 5).map((p) => (
                <PersonAvatar key={p.id} person={p} size="md" link className="ring-2 ring-card" />
              ))}
            </div>
            <p className="min-w-0 text-base">
              Hoje é o aniversário de <b>{joinNames(birthdaysToday.map((p) => p.name))}</b>! 🎉
            </p>
          </div>
        )}

        <Section
          icon={Plane}
          title="Viagens"
          action={
            me && (
              <button type="button" onClick={() => setTripOpen(true)} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                <Plus className="h-4 w-4" /> viagem
              </button>
            )
          }
        >
          {tripsShown.length === 0 && <Empty>Nenhuma viagem de colegas nos próximos 30 dias.</Empty>}
          {tripsShown.map((t) => (
            <Row
              key={t.id}
              left={t.person ? <PersonAvatar person={t.person} size="md" link /> : <NameAvatar name={t.leaderName} />}
              title={t.person?.name ?? t.leaderName}
              subtitle={t.destinationBranch.split(' - ')[0]}
              detail={span(t.startDate, t.endDate)}
            />
          ))}
        </Section>

        <Section
          icon={TreePalm}
          title="Férias"
          action={
            permissions.canManageVacation && (
              <Link href="/admin/travel-birthdays" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                <Plus className="h-4 w-4" /> férias
              </Link>
            )
          }
        >
          {away.length === 0 && <Empty>Ninguém de férias nas próximas duas semanas.</Empty>}
          {away.map((v) => {
            const started = (parseLocalDate(v.startDate)?.getTime() ?? 0) <= now.getTime();
            return (
              <Row
                key={v.id}
                left={v.person ? <PersonAvatar person={v.person} size="md" link /> : <NameAvatar name={v.name} />}
                title={v.person?.name ?? v.name}
                subtitle={v.person ? [v.person.area, v.person.city].filter(Boolean).join(' · ') : undefined}
                detail={started ? `volta ${dayAfter(v.endDate)}` : `a partir de ${dm(v.startDate)}`}
              />
            );
          })}
        </Section>
      </div>

      <TripDialog open={tripOpen} onOpenChange={setTripOpen} />
    </Card>
  );
}
