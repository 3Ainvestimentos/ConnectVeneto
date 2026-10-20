"use client";

import React, { useMemo, useState } from 'react';
import { BookmarkPlus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  MAX_PERSONAL_LINKS,
  PERSONAL_SECTION_LABEL,
  type ConsultaLinksSession,
  type MyConsultaLink,
} from '@/config/consulta-links';
import { useConsultaMutations, type LinkDraft } from '@/hooks/useConsultaLinks';
import { LinkCard } from './LinkCard';
import { LinkFormDialog } from './LinkFormDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

type Section = { key: string; label: string; typeName?: string; links: MyConsultaLink[] };

const matches = (link: MyConsultaLink, term: string) =>
  !term || `${link.title} ${link.url} ${link.description}`.toLowerCase().includes(term);

/**
 * "Barra de favoritos" da pessoa: os links que ela mesma salvou e, abaixo, os
 * que os administradores de cada tipo (MESA, CX...) mantêm para ela.
 */
export function PersonalLinkLibrary({ session }: { session: ConsultaLinksSession }) {
  const { toast } = useToast();
  const { createLink, updateLink, deleteLink } = useConsultaMutations();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MyConsultaLink | null>(null);
  const [deleting, setDeleting] = useState<MyConsultaLink | null>(null);

  const term = search.trim().toLowerCase();
  const personalCount = session.links.filter((link) => link.kind === 'personal').length;

  const sections = useMemo<Section[]>(() => {
    const visible = session.links.filter((link) => matches(link, term));
    const typed = session.types
      .map((type) => ({
        key: type.id,
        label: type.name,
        typeName: type.name,
        links: visible.filter((link) => link.typeId === type.id),
      }))
      .filter((section) => section.links.length > 0);
    return [
      { key: 'personal', label: PERSONAL_SECTION_LABEL, links: visible.filter((link) => link.kind === 'personal') },
      ...typed,
    ];
  }, [session, term]);

  const canEdit = (link: MyConsultaLink) => link.kind === 'personal';

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleSubmit = async (draft: LinkDraft) => {
    if (editing) {
      await updateLink.mutateAsync({ id: editing.id, ...draft });
      toast({ title: 'Link atualizado' });
    } else {
      await createLink.mutateAsync(draft);
      toast({ title: 'Link salvo', description: draft.title });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteLink.mutateAsync(deleting.id);
      toast({ title: 'Link excluído' });
    } catch (error) {
      toast({
        title: 'Não foi possível excluir',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const nothingFound = term && sections.every((section) => section.links.length === 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar nos seus links"
            className="pl-9"
            aria-label="Buscar nos seus links"
          />
        </div>
        <Button onClick={openNew} disabled={personalCount >= MAX_PERSONAL_LINKS}>
          <BookmarkPlus className="mr-2 h-4 w-4" />
          Salvar link
        </Button>
      </div>

      {nothingFound && (
        <p className="text-sm text-muted-foreground">Nenhum link encontrado para “{search.trim()}”.</p>
      )}

      {sections.map((section) => {
        if (section.key === 'personal' && section.links.length === 0) {
          if (term) return null;
          return (
            <section key={section.key} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{section.label}</h2>
              <button
                type="button"
                onClick={openNew}
                className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <BookmarkPlus className="h-6 w-6" />
                <span className="font-medium text-foreground">Você ainda não salvou nenhum link</span>
                <span>Guarde aqui as planilhas, dashboards e sites que você usa no dia a dia. Só você vê esses links.</span>
              </button>
            </section>
          );
        }
        if (section.links.length === 0) return null;

        return (
          <section key={section.key} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {section.label}
              <span className="ml-2 font-normal normal-case tracking-normal">({section.links.length})</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {section.links.map((link) => (
                <LinkCard
                  key={link.id}
                  link={link}
                  managedBy={section.typeName}
                  onEdit={canEdit(link) ? (target) => { setEditing(target); setFormOpen(true); } : undefined}
                  onDelete={canEdit(link) ? setDeleting : undefined}
                />
              ))}
            </div>
          </section>
        );
      })}

      <LinkFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar link' : 'Salvar link'}
        description={'Só você vê os links que salva aqui.'}
        initial={editing ? { title: editing.title, url: editing.url, description: editing.description } : undefined}
        onSubmit={handleSubmit}
      />

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir link?"
        description={<>O link <strong>{deleting?.title}</strong> sai da sua Consulta Pessoal.</>}
        onConfirm={handleDelete}
      />
    </div>
  );
}
