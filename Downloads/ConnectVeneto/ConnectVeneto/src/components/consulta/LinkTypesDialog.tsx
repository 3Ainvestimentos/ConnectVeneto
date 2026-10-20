"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { linkTypeFieldsSchema, type ConsultaLinkType } from '@/config/consulta-links';
import { useConsultaMutations } from '@/hooks/useConsultaLinks';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { LabelChecklist } from './AudiencePicker';
import { distinctLabels } from './audience';
import { TypeAdminsList } from './TypeAdminsList';

type FormState = { id?: string; name: string; description: string; admins: string; adminAreas: string[]; order: string };

const EMPTY_FORM: FormState = { name: '', description: '', admins: '', adminAreas: [], order: '0' };

const toForm = (type: ConsultaLinkType): FormState => ({
  id: type.id,
  name: type.name,
  description: type.description,
  admins: type.adminEmails.join('\n'),
  adminAreas: type.adminAreas,
  order: String(type.order),
});

/** Super admin: cria os tipos de link (MESA, CX...) e define quem administra cada um. */
export function LinkTypesDialog({
  open,
  onOpenChange,
  types,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: ConsultaLinkType[];
}) {
  const { toast } = useToast();
  const { saveType, deleteType } = useConsultaMutations();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ConsultaLinkType | null>(null);
  const { collaborators } = useCollaborators();
  const areas = useMemo(() => distinctLabels(collaborators, (c) => c.area), [collaborators]);

  useEffect(() => {
    if (!open) {
      setForm(null);
      setError(null);
    }
  }, [open]);

  const set = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((previous) => (previous ? { ...previous, [field]: event.target.value } : previous));

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;

    const parsed = linkTypeFieldsSchema.safeParse({
      name: form.name,
      description: form.description,
      adminEmails: form.admins.split(/[\s,;]+/).filter(Boolean),
      adminAreas: form.adminAreas,
      order: Number.parseInt(form.order, 10) || 0,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Confira os campos.');

    setError(null);
    try {
      await saveType.mutateAsync({ id: form.id, ...parsed.data });
      toast({ title: form.id ? 'Tipo atualizado' : 'Tipo criado', description: parsed.data.name });
      setForm(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar.');
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteType.mutateAsync(deleting.id);
      toast({ title: 'Tipo excluído', description: deleting.name });
    } catch (deleteError) {
      toast({
        title: 'Não foi possível excluir',
        description: deleteError instanceof Error ? deleteError.message : undefined,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tipos de link</DialogTitle>
          <DialogDescription>
            Cada tipo tem seus administradores, que consultam e editam os links daquele tipo de todos os colaboradores.
          </DialogDescription>
        </DialogHeader>

        {form ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
              <div className="space-y-2">
                <Label htmlFor="type-name">Nome</Label>
                <Input id="type-name" value={form.name} onChange={set('name')} placeholder="Ex.: MESA" maxLength={40} autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type-order">Ordem</Label>
                <Input id="type-order" type="number" min={0} max={999} value={form.order} onChange={set('order')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type-description">Descrição (opcional)</Label>
              <Input id="type-description" value={form.description} onChange={set('description')} maxLength={200} />
            </div>
            <LabelChecklist
              title="Áreas administradoras"
              options={areas}
              selected={form.adminAreas}
              onToggle={(area) =>
                setForm((previous) =>
                  previous
                    ? {
                        ...previous,
                        adminAreas: previous.adminAreas.includes(area)
                          ? previous.adminAreas.filter((item) => item !== area)
                          : [...previous.adminAreas, area],
                      }
                    : previous
                )
              }
            />
            <p className="-mt-2 text-xs text-muted-foreground">
              Quem está na área (pelo cadastro atual) administra o tipo — quem entra passa a administrar, quem sai deixa.
            </p>
            <div className="space-y-2">
              <Label htmlFor="type-admins">Administradores avulsos</Label>
              <Textarea
                id="type-admins"
                value={form.admins}
                onChange={set('admins')}
                rows={3}
                placeholder={'nome.sobrenome@venetomfo.com.br\noutra.pessoa@venetomfo.com.br'}
              />
              <p className="text-xs text-muted-foreground">Um e-mail por linha, para quem está fora das áreas acima. Super admins administram todos os tipos.</p>
            </div>
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <Label>Quem vai administrar hoje</Label>
              <TypeAdminsList
                type={{
                  adminAreas: form.adminAreas,
                  adminEmails: form.admins.split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean),
                }}
                emptyText="Ninguém além dos super admins — marque uma área ou informe e-mails."
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setForm(null); setError(null); }}>
                Voltar
              </Button>
              <Button type="submit" disabled={saveType.isPending}>
                {saveType.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            {types.length === 0 && <p className="text-sm text-muted-foreground">Nenhum tipo criado ainda.</p>}
            {types.map((type) => (
              <div key={type.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="font-medium">{type.name}</div>
                  {type.description && <div className="text-xs text-muted-foreground">{type.description}</div>}
                  <div className="mt-1 break-words text-xs text-muted-foreground">
                    {type.adminAreas.length + type.adminEmails.length > 0
                      ? [...type.adminAreas.map((area) => `Área ${area}`), ...type.adminEmails].join(', ')
                      : 'Sem administradores (só super admins)'}
                  </div>
                </div>
                <div className="flex shrink-0">
                  <Button variant="ghost" size="icon" aria-label={`Editar ${type.name}`} onClick={() => setForm(toForm(type))}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir ${type.name}`}
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleting(type)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={() => setForm({ ...EMPTY_FORM, order: String(types.length) })}>
              <Plus className="mr-2 h-4 w-4" /> Novo tipo
            </Button>
          </div>
        )}

        <ConfirmDeleteDialog
          open={!!deleting}
          onOpenChange={(isOpen) => !isOpen && setDeleting(null)}
          title={`Excluir o tipo ${deleting?.name ?? ''}?`}
          description="Só é possível excluir um tipo sem links. Exclua os links dele antes."
          onConfirm={handleDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
