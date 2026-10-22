"use client";

import { useState } from 'react';
import Link from 'next/link';
import { FolderTree, Info, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HubPage } from '@/components/hub-feed/HubPage';
import { OrgStructureView } from '@/components/hub-feed/OrgStructureView';
import { PersonAvatar } from '@/components/hub-feed/PersonAvatar';
import { useHubPeople } from '@/hooks/useHubPeople';
import { useCanEditStructure, useOrgUnits } from '@/hooks/useOrgUnits';
import { normalizeName } from '@/lib/hub/people';

/** Pessoas e equipes: o organograma pela estrutura (ADR 0004) ocupa a tela; a busca troca o desenho pela lista. */
export default function PessoasPage() {
  const { people, loading } = useHubPeople();
  const [query, setQuery] = useState('');
  const { units } = useOrgUnits();
  const canEditStructure = useCanEditStructure();

  const searchResults = query
    ? people.filter((p) => normalizeName(`${p.name} ${p.position} ${p.team ?? ''} ${p.area}`).includes(normalizeName(query))).slice(0, 60)
    : [];

  return (
    <HubPage className="max-w-none space-y-4 px-4 py-4 sm:px-6 md:px-6 md:py-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-headline text-2xl font-bold">Pessoas e equipes</h1>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pessoa, cargo ou equipe" className="pl-9" aria-label="Buscar pessoas" />
          </div>
          {canEditStructure && (
            <Button asChild variant="outline">
              <Link href="/pessoas/estrutura">
                <FolderTree className="mr-2 h-4 w-4" /> Editar estrutura
              </Link>
            </Button>
          )}
        </div>
      </header>

      {loading && people.length === 0 && (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando pessoas…
        </p>
      )}

      {query ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {searchResults.length === 0 && <p className="text-base text-muted-foreground">Ninguém encontrado para “{query}”.</p>}
          {searchResults.map((p) => (
            <Link key={p.id} href={`/pessoas/${p.id}`} className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted">
              <PersonAvatar person={p} size="sm" />
              <div className="min-w-0 text-base">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {p.position} · {p.team ?? p.area}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : units.length > 0 ? (
        <OrgStructureView units={units} people={people} canEdit={canEditStructure} />
      ) : (
        !loading && (
          <div className="flex items-start gap-3 rounded-xl border bg-card p-5 text-base">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p>
              A estrutura da Vêneto ainda não foi cadastrada. Enquanto isso, use a busca acima para achar alguém.
              {canEditStructure && (
                <>
                  {' '}
                  <Link href="/pessoas/estrutura" className="font-medium text-primary hover:underline">
                    Cadastrar a estrutura
                  </Link>
                </>
              )}
            </p>
          </div>
        )
      )}
    </HubPage>
  );
}
