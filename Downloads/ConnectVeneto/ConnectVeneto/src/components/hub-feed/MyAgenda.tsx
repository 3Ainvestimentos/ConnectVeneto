"use client";

import { useState } from 'react';
import { Pencil, Plane, Plus, Trash2, TreePalm } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHubMock } from '@/lib/hub-mock/store';
import type { Trip, VacationStatus } from '@/lib/hub-mock/types';
import { cn } from '@/lib/utils';
import { TripDialog } from './TripDialog';
import { VacationDialog } from './VacationDialog';
import { period } from './format';

const STATUS: Record<VacationStatus, { label: string; className: string }> = {
  pending: { label: 'Aguardando aprovação', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' },
  approved: { label: 'Aprovadas', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  rejected: { label: 'Recusadas', className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
};

/** "Minhas viagens e férias" no próprio perfil: onde a pessoa cadastra, edita e cancela. */
export function MyAgenda() {
  const { trips, vacations, meId, deleteTrip, cancelVacation, personById } = useHubMock();
  const [tripDialog, setTripDialog] = useState<{ open: boolean; trip?: Trip }>({ open: false });
  const [vacationOpen, setVacationOpen] = useState(false);

  const now = Date.now();
  const myTrips = trips.filter((t) => t.personId === meId && new Date(t.end).getTime() >= now).sort((a, b) => a.start.localeCompare(b.start));
  const myVacations = vacations.filter((v) => v.personId === meId && new Date(v.end).getTime() >= now).sort((a, b) => a.start.localeCompare(b.start));

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
        {myTrips.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-base">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{t.destination}</div>
              <div className="truncate text-sm text-muted-foreground">
                {period(t.start, t.end)}
                {t.purpose && ` · ${t.purpose}`}
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar viagem" onClick={() => setTripDialog({ open: true, trip: t })}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Cancelar viagem" onClick={() => deleteTrip(t.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-1.5 text-base font-semibold">
            <TreePalm className="h-4 w-4 text-muted-foreground" /> Férias
          </h3>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setVacationOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Solicitar
          </Button>
        </div>
        {myVacations.length === 0 && <p className="text-base text-muted-foreground">Nenhuma férias marcada.</p>}
        {myVacations.map((v) => (
          <div key={v.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-base">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{period(v.start, v.end)}</div>
              <div className="text-sm text-muted-foreground">Aprovação: {personById(v.approverId).name}</div>
            </div>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS[v.status].className)}>{STATUS[v.status].label}</span>
            {v.status === 'pending' && (
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Cancelar solicitação" onClick={() => cancelVacation(v.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <TripDialog open={tripDialog.open} trip={tripDialog.trip} onOpenChange={(open) => setTripDialog((s) => ({ ...s, open }))} />
      <VacationDialog open={vacationOpen} onOpenChange={setVacationOpen} />
    </div>
  );
}
