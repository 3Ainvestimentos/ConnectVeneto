"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { UNITS, daysFromNow } from '@/lib/hub-mock/data';
import { useHubMock } from '@/lib/hub-mock/store';
import type { Trip } from '@/lib/hub-mock/types';
import { fromDateInput, period, toDateInput } from './format';

const OTHER = '__outra';

/**
 * Registrar viagem: autosserviço, sem aprovação. Serve para os colegas da cidade de destino
 * saberem quem vem e aproveitarem para marcar reuniões.
 */
export function TripDialog({
  open,
  onOpenChange,
  trip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: Trip;
}) {
  const { saveTrip, me } = useHubMock();
  const [unit, setUnit] = useState(UNITS[1]);
  const [otherCity, setOtherCity] = useState('');
  const [start, setStart] = useState(toDateInput(daysFromNow(7)));
  const [end, setEnd] = useState(toDateInput(daysFromNow(8)));
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const isUnit = trip ? UNITS.includes(trip.destination) : true;
    setUnit(trip ? (isUnit ? trip.destination : OTHER) : UNITS.find((u) => u !== me.city) ?? UNITS[0]);
    setOtherCity(trip && !isUnit ? trip.destination : '');
    setStart(toDateInput(trip?.start ?? daysFromNow(7)));
    setEnd(toDateInput(trip?.end ?? daysFromNow(8)));
    setPurpose(trip?.purpose ?? '');
    setError('');
  }, [open, trip, me.city]);

  const save = () => {
    const destination = unit === OTHER ? otherCity.trim() : unit;
    if (!destination) return setError('Informe a cidade de destino.');
    if (end < start) return setError('A volta precisa ser depois da ida.');
    saveTrip({ id: trip?.id, destination, start: fromDateInput(start), end: fromDateInput(end), purpose: purpose.trim() || undefined });
    toast({
      title: trip ? 'Viagem atualizada' : 'Viagem registrada',
      description: `Quem está em ${destination} vai ver que você estará lá de ${period(fromDateInput(start), fromDateInput(end))}.`,
    });
    onOpenChange(false);
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
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    Unidade {u}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER}>Outra cidade</SelectItem>
              </SelectContent>
            </Select>
            {unit === OTHER && (
              <Input aria-label="Cidade" value={otherCity} onChange={(e) => setOtherCity(e.target.value)} placeholder="Ex.: Brasília" />
            )}
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
          <div className="grid gap-1.5">
            <Label htmlFor="trip-purpose">Motivo (opcional)</Label>
            <Input id="trip-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Ex.: Café com Investidores" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>{trip ? 'Salvar' : 'Registrar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
