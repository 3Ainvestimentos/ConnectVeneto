"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FolderTree, Info, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/PageHeader';
import { HubBreadcrumb, HubPage } from '@/components/hub-feed/HubPage';
import { OrgStructureView } from '@/components/hub-feed/OrgStructureView';
import { PersonAvatar } from '@/components/hub-feed/PersonAvatar';
import { ReportingChart } from '@/components/hub-feed/ReportingChart';
import { useAuth } from '@/contexts/AuthContext';
import { useHubPeople } from '@/hooks/useHubPeople';
import { useCanEditStructure, useOrgUnits } from '@/hooks/useOrgUnits';
import { normalizeName, topLeaders, type HubPerson } from '@/lib/hub/people';
import { cn } from '@/lib/utils';

const ALL = 'Todos';

export default function PessoasPage() {
  const { isSuperAdmin } = useAuth();
  const { people, loading } = useHubPeople();
  const [axis, setAxis] = useState(ALL);
  const [query, setQuery] = useState('');
  const { units } = useOrgUnits();
  const canEditStructure = useCanEditStructure();
  // Abre por estrutura quando ela já diz algo (responsável ou hierarquia); antes disso, por pessoa (quem reporta a quem).
  const [view, setView] = useState<'estrutura' | 'pessoa' | null>(null);
  const effectiveView = view ?? (units.some((u) => u.leaderIdVeneto || u.parentId) ? 'estrutura' : 'pessoa');

  // Eixo só vira filtro quando é dado de verdade: ignora traços e valores de uma pessoa só.
  const axes = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of people) if (p.axis && !/^[\s\-—–]*$/.test(p.axis)) count.set(p.axis, (count.get(p.axis) ?? 0) + 1);
    return [
      ALL,
      ...[...count]
        .filter(([, n]) => n > 1)
        .map(([a]) => a)
        .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    ];
  }, [people]);

  const tops = useMemo(() => topLeaders(people), [people]);
  // Fora da árvore: sem gestor e sem liderados (normalmente cadastro incompleto ou conta de teste).
  const outside = useMemo(() => {
    const leads = new Set(people.map((p) => p.managerId));
    return people.filter((p) => p.managerId === null && !leads.has(p.id));
  }, [people]);

  const matches = (p: HubPerson) =>
    (axis === ALL || p.axis === axis) && (!query || normalizeName(`${p.name} ${p.position} ${p.team ?? ''} ${p.area}`).includes(normalizeName(query)));
  const searchResults = query ? people.filter(matches).slice(0, 60) : [];
  const canFix = isSuperAdmin;

  return (
    <HubPage>
      <HubBreadcrumb items={[{ label: 'Início', href: '/inicio' }, { label: 'Pessoas e equipes' }]} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="Pessoas e equipes" description="Quem é quem na Vêneto, por estrutura e por liderança." />
        {canEditStructure && (
          <Button asChild variant="outline">
            <Link href="/pessoas/estrutura">
              <FolderTree className="mr-2 h-4 w-4" /> Editar estrutura
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pessoa, cargo ou equipe" className="pl-9" aria-label="Buscar pessoas" />
          </div>
          {axes.length > 2 && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por eixo">
              <span className="mr-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Eixo</span>
              {axes.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={axis === a}
                  onClick={() => setAxis(a)}
                  className={cn('rounded-full border px-3 py-1 text-sm', axis === a ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted')}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>

        {!query && units.length > 0 && (
          <div className="inline-flex rounded-lg bg-muted p-1 text-sm" role="tablist" aria-label="Vista do organograma">
            {(
              [
                ['pessoa', 'Por liderança'],
                ['estrutura', 'Por estrutura'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={effectiveView === value}
                onClick={() => setView(value)}
                className={cn('rounded-md px-3 py-1.5 font-medium', effectiveView === value ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && people.length === 0 && (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando pessoas…
        </p>
      )}

      {!query && effectiveView === 'estrutura' && units.length > 0 ? (
        <OrgStructureView units={units} people={people} canEdit={canEditStructure} />
      ) : query ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
      ) : tops.length === 0 && !loading ? (
        <div className="flex items-start gap-3 rounded-xl border bg-card p-5 text-base">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p>
            O organograma aparece quando o RH indicar o gestor de cada pessoa no cadastro. Enquanto isso, use a busca acima para achar alguém.
            {canFix && (
              <>
                {' '}
                <Link href="/admin" className="font-medium text-primary hover:underline">
                  Abrir o cadastro de colaboradores
                </Link>
              </>
            )}
          </p>
        </div>
      ) : (
        <>
          <ReportingChart people={people} isDimmed={(p) => axis !== ALL && !matches(p)} />
          {canFix && outside.length > 0 && (
            <details className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              <summary className="flex cursor-pointer items-center gap-2">
                <Info className="h-4 w-4 shrink-0" /> {outside.length} {outside.length === 1 ? 'pessoa está' : 'pessoas estão'} fora do organograma, sem gestor no
                cadastro. Só administradores veem este aviso.
              </summary>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {outside.map((p) => (
                  <Link key={p.id} href={`/pessoas/${p.id}`} className="rounded-full bg-muted px-2.5 py-1 text-foreground hover:bg-muted/70">
                    {p.name}
                  </Link>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </HubPage>
  );
}
