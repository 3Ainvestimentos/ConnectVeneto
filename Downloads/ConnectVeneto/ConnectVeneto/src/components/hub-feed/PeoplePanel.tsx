"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Cake, Loader2, Plane, Plus, Trash2, TreePalm, Users, type LucideIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useTripsBirthdays } from '@/contexts/TripsBirthdaysContext';
import { toast } from '@/hooks/use-toast';
import { useApprovedVacations, useHubPeople, useHubTrips, type HubTrip } from '@/hooks/useHubPeople';
import { isBirthdayOn, normalizeCity, overlapsRange, parseLocalDate, tripKey } from '@/lib/hub/people';
import { PersonAvatar } from './PersonAvatar';
import { TripDialog } from './TripDialog';
import { initialsOf } from './UserAvatar';

const DAY = 24 * 60 * 60 * 1000;
const MAX_ROWS = 4;
/** Viagens que entram no quadro: em andamento ou começando nos próximos 90 dias (a lista rola). */
const TRIP_WINDOW_DAYS = 90;

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

/** Linha compacta de viagem: "Nome → Destino" na 1ª linha, datas embaixo; lixeira para quem registrou. */
function TripRow({ trip, mine, isMe, onDelete }: { trip: HubTrip; mine: boolean; isMe: boolean; onDelete: () => void }) {
  const name = trip.person?.name ?? trip.leaderName;
  const city = trip.destinationBranch.split(' - ')[0];
  return (
    <li className="flex min-w-0 items-center gap-3">
      {trip.person ? <PersonAvatar person={trip.person} size="md" link /> : <NameAvatar name={trip.leaderName} />}
      <div className="min-w-0 flex-1 leading-snug">
        <div className="flex min-w-0 items-baseline gap-1.5 text-[15px]" title={`${name} → ${trip.destinationBranch}`}>
          <span className="truncate font-medium">{name}</span>
          <span className="shrink-0 text-muted-foreground" aria-label="indo para">
            →
          </span>
          <span className="min-w-0 truncate text-muted-foreground">{city}</span>
        </div>
        <div className="text-sm tabular-nums text-muted-foreground">
          {span(trip.startDate, trip.endDate)}
          {isMe && <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-px text-xs font-semibold text-primary">você</span>}
        </div>
      </div>
      {mine && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Excluir viagem para ${city}`}
          title="Excluir viagem"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

/** "Ana", "Ana e Bruno", "Ana, Bruno e Carla". */
const joinNames = (names: string[]) => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`);

/**
 * Pessoas e equipes na Home: aniversariantes do dia (faixa, só quando há), viagens nos próximos 90
 * dias (quem vem para a sua cidade primeiro; as suas também aparecem, para você ver que registrou e
 * poder excluir) e férias aprovadas nos próximos 30 dias.
 */
export function PeoplePanel() {
  const { user, permissions } = useAuth();
  const { people, me } = useHubPeople();
  const { trips } = useHubTrips();
  const { deleteTripMutation } = useTripsBirthdays();
  const { vacations } = useApprovedVacations();
  const [tripOpen, setTripOpen] = useState(false);
  const [toDelete, setToDelete] = useState<HubTrip | null>(null);

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * DAY);
  const tripLimit = new Date(now.getTime() + TRIP_WINDOW_DAYS * DAY);

  const birthdaysToday = people.filter((p) => isBirthdayOn(p.birthDate, now));

  // Registros repetidos (a mesma viagem salva mais de uma vez) viram uma linha só.
  const seen = new Set<string>();
  const upcomingTrips = trips
    .filter((t) => overlapsRange(t.startDate, t.endDate, now, tripLimit))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate))
    .filter((t) => {
      const key = tripKey(t);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const myCity = normalizeCity(me?.city);
  const tripsShown = [
    ...upcomingTrips.filter((t) => myCity && normalizeCity(t.destinationBranch) === myCity),
    ...upcomingTrips.filter((t) => !myCity || normalizeCity(t.destinationBranch) !== myCity),
  ];

  const confirmDelete = async () => {
    if (!toDelete || !user) return;
    // Apaga também as cópias repetidas que a mesma pessoa registrou, senão a linha continuaria lá.
    const key = tripKey(toDelete);
    const ids = trips.filter((t) => t.responsavelUid === user.uid && tripKey(t) === key).map((t) => t.id);
    try {
      for (const id of ids) await deleteTripMutation.mutateAsync(id);
      toast({ title: 'Viagem excluída' });
      setToDelete(null);
    } catch {
      toast({ title: 'Não foi possível excluir', description: 'Só quem registrou a viagem pode excluí-la.', variant: 'destructive' });
    }
  };

  const away = vacations
    .filter((v) => overlapsRange(v.startDate, v.endDate, now, in30))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const awayShown = away.slice(0, MAX_ROWS);

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
            user && (
              <button type="button" onClick={() => setTripOpen(true)} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                <Plus className="h-4 w-4" /> viagem
              </button>
            )
          }
        >
          {tripsShown.length === 0 ? (
            <Empty>Nenhuma viagem nos próximos {TRIP_WINDOW_DAYS} dias.</Empty>
          ) : (
            <ul className="-mr-2 grid max-h-[16.5rem] gap-3 overflow-y-auto overscroll-contain pr-2" aria-label="Viagens">
              {tripsShown.map((t) => (
                <TripRow
                  key={t.id}
                  trip={t}
                  mine={!!user && t.responsavelUid === user.uid}
                  isMe={(!!me && t.person?.id === me.id) || (!!user && t.responsavelUid === user.uid && !t.person)}
                  onDelete={() => setToDelete(t)}
                />
              ))}
            </ul>
          )}
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
          {away.length === 0 && <Empty>Ninguém de férias nos próximos 30 dias.</Empty>}
          {awayShown.map((v) => {
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
          {away.length > awayShown.length && <Empty>+ {away.length - awayShown.length} de férias no período</Empty>}
        </Section>
      </div>

      <TripDialog open={tripOpen} onOpenChange={setTripOpen} />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && !deleteTripMutation.isPending && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta viagem?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete &&
                `${toDelete.person?.name ?? toDelete.leaderName} → ${toDelete.destinationBranch}, ${span(toDelete.startDate, toDelete.endDate)}. Ela some do quadro de Viagens para todo mundo.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTripMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleteTripMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTripMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
