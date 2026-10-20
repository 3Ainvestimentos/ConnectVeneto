"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTripsBirthdays, type LeaderTripType } from '@/contexts/TripsBirthdaysContext';
import { toast } from '@/hooks/use-toast';
import { useHubPeople } from '@/hooks/useHubPeople';
import { normalizeCity } from '@/lib/hub/people';
import { TRIP_DESTINATIONS } from '@/lib/trips';

const OTHER = '__outra';
const DAY = 24 * 60 * 60 * 1000;
const dateInput = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const br = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

/**
 * Registrar viagem: autosserviço, sem aprovação (grava em `leaderTrips`, a mesma base do admin de
 * Viagens). Serve para os colegas do destino saberem quem vem e marcarem um encontro.
 */
export function TripDialog({ open, onOpenChange, trip }: { open: boolean; onOpenChange: (open: boolean) => void; trip?: LeaderTripType }) {
  const { addTrip, updateTrip } = useTripsBirthdays();
  const { me } = useHubPeople();
  const [unit, setUnit] = useState<string>(TRIP_DESTINATIONS[0]);
  const [otherCity, setOtherCity] = useState('');
  const [start, setStart] = useState(dateInput(7));
  const [end, setEnd] = useState(dateInput(8));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const known = (TRIP_DESTINATIONS as readonly string[]).includes(trip?.destinationBranch ?? '');
    const notMine = TRIP_DESTINATIONS.find((d) => normalizeCity(d) !== normalizeCity(me?.city)) ?? TRIP_DESTINATIONS[0];
    setUnit(trip ? (known ? trip.destinationBranch : OTHER) : notMine);
    setOtherCity(trip && !known ? trip.destinationBranch : '');
    setStart(trip?.startDate ?? dateInput(7));
    setEnd(trip?.endDate ?? dateInput(8));
    setError('');
  }, [open, trip, me?.city]);

  const save = async () => {
    const destinationBranch = unit === OTHER ? otherCity.trim() : unit;
    if (!destinationBranch) return setError('Informe a cidade de destino.');
    if (!start || !end) return setError('Informe a ida e a volta.');
    if (end < start) return setError('A volta precisa ser depois da ida.');
    if (!me) return setError('Seu cadastro de colaborador não foi encontrado.');
    setSaving(true);
    try {
      if (trip) await updateTrip({ ...trip, destinationBranch, startDate: start, endDate: end });
      else await addTrip({ leaderName: me.name, destinationBranch, startDate: start, endDate: end });
      toast({
        title: trip ? 'Viagem atualizada' : 'Viagem registrada',
        description: `Quem está em ${destinationBranch.split(' - ')[0]} vai ver que você estará lá de ${br(start)} a ${br(end)}.`,
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar a viagem.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{trip ? 'Editar viagem' : 'Registrar viagem'}</DialogTitle>
          <DialogDescription>Os colegas do destino veem quem está chegando e podem marcar um encontro.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="trip-dest">Destino</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger id="trip-dest">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIP_DESTINATIONS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER}>Outra cidade</SelectItem>
              </SelectContent>
            </Select>
            {unit === OTHER && <Input aria-label="Cidade" value={otherCity} onChange={(e) => setOtherCity(e.target.value)} placeholder="Ex.: Brasília - DF" />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="trip-start">Ida</Label>
              <Input id="trip-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="trip-end">Volta</Label>
              <Input id="trip-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {trip ? 'Salvar' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
