
"use client";

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarEvent } from './GoogleCalendar';
import { format, parseISO } from 'date-fns';
import { Trash2, Loader2 } from 'lucide-react';

const eventSchema = z.object({
  summary: z.string().min(1, 'O título é obrigatório.'),
  description: z.string().optional(),
  startDateTime: z.string().min(1, 'A data/hora de início é obrigatória.'),
  endDateTime: z.string().min(1, 'A data/hora de término é obrigatória.'),
}).refine(data => new Date(data.endDateTime) >= new Date(data.startDateTime), {
  message: 'A data de término deve ser posterior à de início.',
  path: ['endDateTime'],
});

type EventFormValues = z.infer<typeof eventSchema>;

interface GoogleEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  selectedDate: Date | null;
  onSave: (eventData: Partial<CalendarEvent>) => void;
  onDelete: (eventId: string) => void;
}

export function GoogleEventModal({ isOpen, onClose, event, selectedDate, onSave, onDelete }: GoogleEventModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
  });

  useEffect(() => {
    if (isOpen) {
      if (event) {
        reset({
          summary: event.summary || '',
          description: event.description || '',
          startDateTime: format(parseISO(event.start.dateTime || event.start.date), "yyyy-MM-dd'T'HH:mm"),
          endDateTime: format(parseISO(event.end.dateTime || event.end.date), "yyyy-MM-dd'T'HH:mm"),
        });
      } else if (selectedDate) {
        reset({
          summary: '',
          description: '',
          startDateTime: format(selectedDate, "yyyy-MM-dd'T'09:00"),
          endDateTime: format(selectedDate, "yyyy-MM-dd'T'10:00"),
        });
      }
    }
  }, [isOpen, event, selectedDate, reset]);

  const onSubmit = async (data: EventFormValues) => {
    setIsSaving(true);
    const eventPayload: Partial<CalendarEvent> = {
      id: event?.id,
      summary: data.summary,
      description: data.description,
      start: {
        dateTime: new Date(data.startDateTime).toISOString(),
        date: '',
      },
      end: {
        dateTime: new Date(data.endDateTime).toISOString(),
        date: '',
      },
    };
    await onSave(eventPayload);
    setIsSaving(false);
  };
  
  const handleDelete = async () => {
    if (event?.id) {
        setIsDeleting(true);
        await onDelete(event.id);
        setIsDeleting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="summary">Título</Label>
            <Input id="summary" {...register('summary')} />
            {errors.summary && <p className="text-destructive text-sm mt-1">{errors.summary.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
                <Label htmlFor="startDateTime">Início</Label>
                <Input id="startDateTime" type="datetime-local" {...register('startDateTime')} />
                {errors.startDateTime && <p className="text-destructive text-sm mt-1">{errors.startDateTime.message}</p>}
            </div>
            <div>
                <Label htmlFor="endDateTime">Término</Label>
                <Input id="endDateTime" type="datetime-local" {...register('endDateTime')} />
                {errors.endDateTime && <p className="text-destructive text-sm mt-1">{errors.endDateTime.message}</p>}
            </div>
          </div>
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" {...register('description')} />
          </div>
          <DialogFooter className="justify-between">
            <div>
                {event && (
                     <Button type="button" variant="destructive" onClick={handleDelete} disabled={isSaving || isDeleting}>
                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                        Deletar
                    </Button>
                )}
            </div>
            <div className="flex gap-2">
                <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isSaving || isDeleting}>Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={isSaving || isDeleting}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Salvar Evento
                </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
