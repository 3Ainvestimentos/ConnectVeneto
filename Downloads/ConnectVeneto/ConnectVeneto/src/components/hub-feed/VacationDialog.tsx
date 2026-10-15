"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { daysFromNow } from '@/lib/hub-mock/data';
import { useHubMock } from '@/lib/hub-mock/store';
import { fromDateInput, toDateInput } from './format';

/** Dias úteis entre duas datas (sem feriados — o fluxo real usa /api/holidays). */
function businessDays(start: string, end: string): number {
  const d = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  let n = 0;
  while (d <= last) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

/**
 * Solicitar férias: vai para o gestor aprovar (fluxo vacation_requests). Só as aprovadas
 * aparecem no card "De férias".
 */
export function VacationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { requestVacation, me, personById } = useHubMock();
  const [start, setStart] = useState(toDateInput(daysFromNow(30)));
  const [end, setEnd] = useState(toDateInput(daysFromNow(44)));
  const [error, setError] = useState('');
  const approver = personById(me.managerId ?? 'ana');
  const days = end >= start ? businessDays(start, end) : 0;

  useEffect(() => {
    if (open) setError('');
  }, [open]);

  const submit = () => {
    if (end < start) return setError('O fim precisa ser depois do início.');
    requestVacation(fromDateInput(start), fromDateInput(end));
    toast({ title: 'Solicitação enviada', description: `${approver.name} recebe o pedido para aprovar.` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar férias</DialogTitle>
          <DialogDescription>
            O pedido vai para {approver.name}. Depois de aprovado, aparece no card De férias da Home e no seu perfil.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="vac-start">Início</Label>
            <Input id="vac-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vac-end">Fim</Label>
            <Input id="vac-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          <b className="tabular-nums text-foreground">{days}</b> dias úteis
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>Enviar para aprovação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
