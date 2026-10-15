"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/PageHeader';
import { HubBreadcrumb, HubPage } from '@/components/hub-feed/HubPage';
import { PersonAvatar } from '@/components/hub-feed/PersonAvatar';
import { WireframeBar } from '@/components/hub-feed/WireframeBar';
import { directReports, teamsOf } from '@/components/hub-feed/org';
import { cn } from '@/lib/utils';
import { useHubMock } from '@/lib/hub-mock/store';
import type { Person } from '@/lib/hub-mock/types';

const AXES = ['Todos', 'Investimentos', 'Comercial', 'Operações', 'Pessoas'];

export default function PessoasPage() {
  const { people } = useHubMock();
  const root = people.find((p) => p.managerId === null)!;
  const leaders = directReports(people, root.id);
  const [selected, setSelected] = useState(leaders.find((l) => directReports(people, l.id).length > 1)?.id ?? leaders[0].id);
  const [axis, setAxis] = useState('Todos');
  const [query, setQuery] = useState('');

  const matches = (p: Person) =>
    (axis === 'Todos' || p.axis === axis) &&
    (!query || `${p.name} ${p.position} ${p.team ?? ''} ${p.area}`.toLowerCase().includes(query.toLowerCase()));

  const searchResults = query ? people.filter(matches) : [];

  const leader = people.find((p) => p.id === selected)!;
  const teams = teamsOf(people, selected);

  return (
    <HubPage>
      <HubBreadcrumb items={[{ label: 'Início', href: '/inicio' }, { label: 'Pessoas e equipes' }]} />
      <PageHeader title="Pessoas e equipes" description="Quem é quem na Vêneto, por liderança e por equipe." />
      <WireframeBar />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pessoa, cargo ou equipe" className="pl-9" aria-label="Buscar pessoas" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por eixo">
          <span className="mr-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Eixo</span>
          {AXES.map((a) => (
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
      </div>

      {query ? (
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
      ) : (
        <>
          <div className="flex flex-col items-center gap-1">
            <PersonAvatar person={root} size="lg" link />
            <Link href={`/pessoas/${root.id}`} className="font-semibold hover:underline">
              {root.name}
            </Link>
            <span className="text-sm text-muted-foreground">{root.position}</span>
            <span className="mt-1 h-4 w-px bg-border" aria-hidden />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {leaders.map((l) => {
              const t = teamsOf(people, l.id);
              const count = directReports(people, l.id).length;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelected(l.id)}
                  aria-pressed={selected === l.id}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border bg-card p-4 text-center text-base transition-shadow',
                    selected === l.id ? 'border-primary ring-4 ring-primary/10' : 'hover:shadow-md',
                    !matches(l) && axis !== 'Todos' && 'opacity-40',
                  )}
                >
                  <PersonAvatar person={l} size="lg" />
                  <span className="font-semibold leading-tight">{l.name}</span>
                  <span className="text-sm leading-tight text-muted-foreground">{l.position}</span>
                  {t.length > 0 ? (
                    <span className="mt-1 flex flex-wrap justify-center gap-1">
                      {t.map(({ team, members }) => (
                        <span key={team} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {team} · {members.length}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="mt-1 text-xs text-muted-foreground">sem equipe direta</span>
                  )}
                  <span className="sr-only">{count} pessoas</span>
                </button>
              );
            })}
          </div>

          <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Equipes de</div>
                <Link href={`/pessoas/${leader.id}`} className="font-headline text-lg font-bold hover:underline">
                  {leader.name}
                </Link>
                <span className="text-base text-muted-foreground"> · {leader.position}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {teams.length} {teams.length === 1 ? 'equipe' : 'equipes'} · {directReports(people, leader.id).length} pessoas
              </span>
            </div>
            {teams.length === 0 ? (
              <p className="text-base text-muted-foreground">{leader.name.split(' ')[0]} não tem equipe direta.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {teams.map(({ team, members }) => (
                  <div key={team} className="rounded-lg border bg-background p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                      {team}
                      <span className="rounded-full bg-primary/10 px-1.5">{members.length}</span>
                    </div>
                    <div className="grid gap-1">
                      {members.map((m) => {
                        const leads = directReports(people, m.id).length;
                        return (
                          <Link
                            key={m.id}
                            href={`/pessoas/${m.id}`}
                            className={cn('flex items-center gap-2.5 rounded-md p-1.5 hover:bg-muted', !matches(m) && 'opacity-40')}
                          >
                            <PersonAvatar person={m} size="sm" />
                            <div className="min-w-0 flex-1 text-base">
                              <div className="truncate font-medium">{m.name}</div>
                              <div className="truncate text-sm text-muted-foreground">
                                {m.position} · {m.city}
                              </div>
                            </div>
                            {leads > 0 && <span className="text-xs text-muted-foreground">lidera {leads}</span>}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </HubPage>
  );
}
