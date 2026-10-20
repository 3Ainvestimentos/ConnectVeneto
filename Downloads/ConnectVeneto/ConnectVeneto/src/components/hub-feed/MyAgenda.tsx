"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Plane, Plus, Trash2, TreePalm } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTripsBirthdays, type LeaderTripType } from '@/contexts/TripsBirthdaysContext';
import { useVacationRequests } from '@/contexts/VacationRequestsContext';
import { toast } from '@/hooks/use-toast';
import { useHubPeople, useHubTrips } from '@/hooks/useHubPeople';
import { parseLocalDate } from '@/lib/hub/people';
import { cn } from '@/lib/utils';
import type { VacationRequestStatus } from '@/types/vacation';
import { TripDialog } from './TripDialog';

const STATUS: Record<VacationRequestStatus, { label: string; className: string }> = {
  pending: { label: 'Aguardando aprovação', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' },
  approved: { label: 'Aprovadas', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  rejected: { label: 'Recusadas', className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
};

const dm = (iso: string) => parseLocalDate(iso)?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) ?? '';
const span = (a: string, b: string) => (a === b ? dm(a) : `${dm(a)} a ${dm(b)}`);
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** "Minhas viagens e férias" no próprio Perfil: viagens que a pessoa registrou e as solicitações de férias dela. */
export function MyAgenda() {
  const { user, permissions } = useAuth();
  const { me } = useHubPeople();
  const { trips } = useHubTrips();
  const { deleteTripMutation } = useTripsBirthdays();
  const { requests } = useVacationRequests();
  const [tripDialog, setTripDialog] = useState<{ open: boolean; trip?: LeaderTripType }>({ open: false });

  const today = todayIso();
  const myTrips = trips
    .filter((t) => (t.responsavelUid === user?.uid || (me && t.person?.id === me.id)) && t.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const myVacations = requests
    .filter((v) => v.requesterUid === user?.uid && v.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const remove = (t: LeaderTripType) =>
    deleteTripMutation
      .mutateAsync(t.id)
      .then(() => toast({ title: 'Viagem cancelada' }))
      .catch(() => toast({ title: 'Não foi possível cancelar', description: 'Só quem registrou a viagem pode cancelar.', variant: 'destructive' }));

  return (
    <div id="agenda" className="grid scroll-mt-24 gap-4 rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="font-headline text-lg font-bold">Minhas viagens e férias</h2>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-1.5 text-base font-semibold">
            <Plane className="h-4 w-4 text-muted-foreground" /> Viagens
          </h3>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setTripDialog({ open: true })}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Registrar
          </Button>
        </div>
        {myTrips.length === 0 && <p className="text-base text-muted-foreground">Nenhuma viagem futura.</p>}
        {myTrips.map((t) => {
          const mine = t.responsavelUid === user?.uid;
          return (
            <div key={t.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-base">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{t.destinationBranch}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {span(t.startDate, t.endDate)}
                  {!mine && ` · registrada por ${t.responsavelNome}`}
                </div>
              </div>
              {mine && (
                <>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar viagem" onClick={() => setTripDialog({ open: true, trip: t })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Cancelar viagem" onClick={() => void remove(t)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-1.5 text-base font-semibold">
            <TreePalm className="h-4 w-4 text-muted-foreground" /> Férias
          </h3>
          {permissions.canManageVacation && (
            <Button size="sm" variant="outline" className="h-8" asChild>
              <Link href="/admin/travel-birthdays">
                <Plus className="mr-1 h-3.5 w-3.5" /> Solicitar
              </Link>
            </Button>
          )}
        </div>
        {myVacations.length === 0 && <p className="text-base text-muted-foreground">Nenhuma férias marcada.</p>}
        {myVacations.map((v) => (
          <div key={v.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-base">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{span(v.startDate, v.endDate)}</div>
              {v.responsibleName && <div className="text-sm text-muted-foreground">Aprovação: {v.responsibleName}</div>}
            </div>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS[v.status].className)}>{STATUS[v.status].label}</span>
          </div>
        ))}
      </div>

      <TripDialog open={tripDialog.open} trip={tripDialog.trip} onOpenChange={(open) => setTripDialog((s) => ({ ...s, open }))} />
    </div>
  );
}
