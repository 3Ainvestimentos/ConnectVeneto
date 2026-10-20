"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus, Settings2, Trash2, User, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import {
  describeAudience,
  linkHostname,
  type ConsultaLink,
  type ConsultaLinksSession,
} from '@/config/consulta-links';
import { useConsultaMutations, useTypeAdmin, type TypedLinkDraft } from '@/hooks/useConsultaLinks';
import { LinkFavicon } from './LinkCard';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { LinkTypesDialog } from './LinkTypesDialog';
import { TypedLinkDialog } from './TypedLinkDialog';
import { IndividualUrlsTable } from './IndividualUrlsTable';

/**
 * Visão do administrador de um tipo de link (MESA, CX...): links Individual (cada
 * pessoa com sua URL) e Compartilhado (mesma URL para um Público de empresa, áreas,
 * equipes ou pessoas), sem passar pelo cadastro do RH.
 */
export function ConsultaAdminPanel({ session }: { session: ConsultaLinksSession }) {
  const { toast } = useToast();
  const { collaborators } = useCollaborators();
  const { saveTypedLink, deleteTypedLink } = useConsultaMutations();

  const adminTypes = useMemo(
    () => session.types.filter((type) => session.adminTypeIds.includes(type.id)),
    [session]
  );
  const [typeId, setTypeId] = useState<string | null>(adminTypes[0]?.id ?? null);
  useEffect(() => {
    if (!typeId || !adminTypes.some((type) => type.id === typeId)) setTypeId(adminTypes[0]?.id ?? null);
  }, [adminTypes, typeId]);

  const activeType = adminTypes.find((type) => type.id === typeId) ?? null;
  const { data, isLoading, error } = useTypeAdmin(typeId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ConsultaLink | null>(null);
  const [deleting, setDeleting] = useState<ConsultaLink | null>(null);
  const [typesOpen, setTypesOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const people = useMemo(
    () => new Map(collaborators.filter((c) => c.email).map((c) => {
      const email = c.email.toLowerCase();
      return [email, { email, name: c.name, area: c.area ?? '' }] as const;
    })),
    [collaborators]
  );

  const links = useMemo(
    () => [...(data?.links ?? [])].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
    [data]
  );

  const handleSubmit = async (draft: TypedLinkDraft) => {
    if (!typeId) return;
    await saveTypedLink.mutateAsync({ id: editing?.id, typeId, draft });
    toast({ title: editing ? 'Link atualizado' : 'Link criado', description: draft.title });
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteTypedLink.mutateAsync(deleting.id);
      toast({ title: 'Link excluído', description: deleting.title });
    } catch (deleteError) {
      toast({
        title: 'Não foi possível excluir',
        description: deleteError instanceof Error ? deleteError.message : undefined,
        variant: 'destructive',
      });
    }
  };

  if (adminTypes.length === 0) {
    return (
      <div className="space-y-4 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        <p>Nenhum tipo de link criado ainda. Crie um tipo (ex.: MESA, CX) e defina quem o administra.</p>
        {session.isSuperAdmin && (
          <Button onClick={() => setTypesOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4" /> Tipos de link
          </Button>
        )}
        <LinkTypesDialog open={typesOpen} onOpenChange={setTypesOpen} types={session.types} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={typeId ?? undefined} onValueChange={(value) => { setTypeId(value); setExpanded(null); }}>
          <SelectTrigger className="sm:w-56" aria-label="Tipo de link">
            <SelectValue placeholder="Tipo de link" />
          </SelectTrigger>
          <SelectContent>
            {adminTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-1 justify-end gap-2">
          {session.isSuperAdmin && (
            <Button variant="outline" onClick={() => setTypesOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" /> Tipos de link
            </Button>
          )}
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} disabled={!typeId}>
            <Plus className="mr-2 h-4 w-4" /> Novo link
          </Button>
        </div>
      </div>

      {activeType && activeType.adminEmails.length + activeType.adminAreas.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Administradores de {activeType.name}:{' '}
          {[
            ...activeType.adminAreas.map((area) => `área ${area}`),
            ...activeType.adminEmails.map((email) => people.get(email)?.name ?? email),
          ].join(', ')}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Falha ao carregar os links.'}</p>
      ) : links.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum link de {activeType?.name} ainda. Crie um link Individual (cada pessoa com sua URL) ou Compartilhado.
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => {
            const linkValues = (data?.values ?? []).filter((value) => value.linkId === link.id);
            const isOpen = expanded === link.id;

            return (
              <div key={link.id} className="rounded-lg border bg-card">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
                      {link.kind === 'shared' ? <LinkFavicon url={link.url} /> : <User className="h-4 w-4 text-muted-foreground" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{link.title}</span>
                        <Badge variant={link.kind === 'shared' ? 'secondary' : 'outline'}>
                          {link.kind === 'shared' ? 'Compartilhado' : 'Individual'}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {link.kind === 'shared'
                            ? `${describeAudience(link.audience)} · ${link.members.length} ${link.members.length === 1 ? 'pessoa' : 'pessoas'} hoje`
                            : `${link.members.length} ${link.members.length === 1 ? 'pessoa tem' : 'pessoas têm'} este link`}
                        </span>
                        {link.kind === 'shared' && (
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                            {linkHostname(link.url)}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                    {link.kind === 'individual' && (
                      <Button variant="outline" size="sm" onClick={() => setExpanded(isOpen ? null : link.id)}>
                        {isOpen ? <ChevronDown className="mr-1 h-4 w-4" /> : <ChevronRight className="mr-1 h-4 w-4" />}
                        URLs
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" aria-label={`Editar ${link.title}`} onClick={() => { setEditing(link); setFormOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir ${link.title}`}
                      onClick={() => setDeleting(link)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t p-4">
                    <IndividualUrlsTable link={link} values={linkValues} people={people} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TypedLinkDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        typeName={activeType?.name ?? ''}
        editing={editing}
        onSubmit={handleSubmit}
      />

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir link?"
        description={
          deleting?.kind === 'individual'
            ? <>O link <strong>{deleting.title}</strong> e as URLs de todas as pessoas serão excluídos.</>
            : <>O link <strong>{deleting?.title}</strong> sai da Consulta de todo o público.</>
        }
        onConfirm={handleDelete}
      />

      <LinkTypesDialog open={typesOpen} onOpenChange={setTypesOpen} types={session.types} />
    </div>
  );
}
