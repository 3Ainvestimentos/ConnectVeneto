"use client";

import React, { useMemo, useState } from 'react';
import { Check, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { linkUrlSchema, type ConsultaLink, type ConsultaLinkValue } from '@/config/consulta-links';
import { useConsultaMutations } from '@/hooks/useConsultaLinks';
import { PersonCombobox } from './PersonCombobox';

type Person = { email: string; name: string; area: string };

const withProtocol = (value: string) => {
  const url = value.trim();
  return url && !/^[a-z][a-z0-9+.-]*:/i.test(url) ? `https://${url}` : url;
};

/** Valida e grava a URL de uma pessoa; devolve a URL gravada ou null. */
function useSaveUrl(linkId: string) {
  const { toast } = useToast();
  const { saveValue } = useConsultaMutations();
  return async (person: Person, raw: string): Promise<string | null> => {
    const parsed = linkUrlSchema.safeParse(withProtocol(raw));
    if (!parsed.success) {
      toast({ title: 'URL inválida', description: parsed.error.issues[0]?.message, variant: 'destructive' });
      return null;
    }
    try {
      await saveValue.mutateAsync({ linkId, ownerEmail: person.email, url: parsed.data });
      toast({ title: 'URL salva', description: person.name });
      return parsed.data;
    } catch (error) {
      toast({ title: 'Não foi possível salvar', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
      return null;
    }
  };
}

function UrlRow({ linkId, person, value }: { linkId: string; person: Person; value: ConsultaLinkValue }) {
  const { toast } = useToast();
  const { deleteValue } = useConsultaMutations();
  const saveUrl = useSaveUrl(linkId);
  const [draft, setDraft] = useState(value.url);
  const [busy, setBusy] = useState(false);
  const dirty = draft.trim() !== value.url;

  const save = async () => {
    setBusy(true);
    const saved = await saveUrl(person, draft);
    if (saved) setDraft(saved);
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteValue.mutateAsync({ linkId, ownerEmail: person.email });
      toast({ title: 'Link removido', description: `${person.name} deixa de ver este link.` });
    } catch (error) {
      toast({ title: 'Não foi possível remover', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
      setBusy(false);
    }
  };

  return (
    <TableRow>
      <TableCell>
        <div className="truncate font-medium">{person.name}</div>
        <div className="truncate text-xs text-muted-foreground">{person.area || person.email}</div>
      </TableCell>
      <TableCell>
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && dirty) {
              event.preventDefault();
              void save();
            }
          }}
          className="h-8 min-w-[12rem] text-xs"
          aria-label={`URL de ${person.name}`}
          disabled={busy}
        />
      </TableCell>
      <TableCell className="w-12 text-right">
        {dirty ? (
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={save} disabled={busy || !draft.trim()} aria-label="Salvar URL">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={remove}
            disabled={busy}
            aria-label={`Remover ${person.name} deste link`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

/** Linha de inclusão: escolhe a pessoa (autocompletar) e cola a URL dela. */
function AddPersonRow({ linkId, people, taken }: { linkId: string; people: Map<string, Person>; taken: Set<string> }) {
  const saveUrl = useSaveUrl(linkId);
  const [person, setPerson] = useState<Person | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => [...people.values()], [people]);

  const add = async () => {
    if (!person) return;
    setBusy(true);
    if (await saveUrl(person, url)) {
      setPerson(null);
      setUrl('');
    }
    setBusy(false);
  };

  return (
    <TableRow className="bg-muted/40 hover:bg-muted/40">
      <TableCell>
        <PersonCombobox
          people={options}
          exclude={taken}
          selected={person}
          onSelect={setPerson}
          placeholder="Adicionar pessoa"
          aria-label="Pessoa"
          disabled={busy}
        />
      </TableCell>
      <TableCell>
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void add();
            }
          }}
          placeholder="URL desta pessoa"
          className="h-8 min-w-[12rem] text-xs"
          aria-label="URL da pessoa"
          disabled={busy}
        />
      </TableCell>
      <TableCell className="w-12 text-right">
        <Button
          size="icon"
          className="h-8 w-8"
          onClick={add}
          disabled={busy || !person || !url.trim()}
          aria-label="Adicionar"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </TableCell>
    </TableRow>
  );
}

/**
 * Quem tem o link Individual e a URL de cada um. Só essas pessoas veem o link —
 * nem todo mundo precisa ter (ex.: nem todos têm planilha da Mesa).
 */
export function IndividualUrlsTable({
  link,
  values,
  people,
}: {
  link: ConsultaLink;
  values: ConsultaLinkValue[];
  people: Map<string, Person>;
}) {
  const [search, setSearch] = useState('');
  const taken = useMemo(() => new Set(values.map((value) => value.ownerEmail)), [values]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return values
      .map((value) => ({ value, person: people.get(value.ownerEmail) ?? { email: value.ownerEmail, name: value.ownerEmail, area: '' } }))
      .filter(({ person }) => !term || `${person.name} ${person.email} ${person.area}`.toLowerCase().includes(term))
      .sort((a, b) => a.person.name.localeCompare(b.person.name, 'pt-BR'));
  }, [values, people, search]);

  return (
    <div className="space-y-3">
      {values.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pessoa ou área" className="h-9 pl-9" />
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pessoa</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <AddPersonRow linkId={link.id} people={people} taken={taken} />
            {rows.map(({ value, person }) => (
              <UrlRow key={`${value.ownerEmail}:${value.url}`} linkId={link.id} person={person} value={value} />
            ))}
            {values.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                  Ninguém tem este link ainda. Adicione as pessoas que precisam dele.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
