"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Users } from 'lucide-react';
import { directReports, managerChain, topLeaders, type HubPerson } from '@/lib/hub/people';
import { cn } from '@/lib/utils';
import { PersonAvatar } from './PersonAvatar';

/** Liderados diretos sem os do topo (no ciclo de sócios, um não aparece debaixo do outro); quem lidera vem antes. */
function useReports(people: HubPerson[], topIds: Set<string>) {
  return useMemo(() => {
    const map = new Map<string, HubPerson[]>();
    for (const p of people) map.set(p.id, directReports(people, p.id).filter((r) => !topIds.has(r.id)));
    for (const [id, list] of map) {
      map.set(id, [...list].sort((a, b) => Number((map.get(b.id)?.length ?? 0) > 0) - Number((map.get(a.id)?.length ?? 0) > 0) || a.name.localeCompare(b.name, 'pt-BR')));
    }
    const total = new Map<string, number>();
    const count = (id: string, seen: Set<string>): number => {
      if (total.has(id)) return total.get(id)!;
      seen.add(id);
      const n = (map.get(id) ?? []).reduce((acc, r) => acc + (seen.has(r.id) ? 0 : 1 + count(r.id, seen)), 0);
      total.set(id, n);
      return n;
    };
    for (const p of people) count(p.id, new Set());
    return { reports: (id: string) => map.get(id) ?? [], total: (id: string) => total.get(id) ?? 0 };
  }, [people, topIds]);
}

function HeadCard({ person, direct, total }: { person: HubPerson; direct: number; total: number }) {
  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-1 rounded-xl border border-primary/30 bg-card p-4 text-center shadow-sm">
      <PersonAvatar person={person} size="lg" link />
      <Link href={`/pessoas/${person.id}`} className="font-headline text-base font-bold leading-tight hover:underline">
        {person.name}
      </Link>
      <span className="text-sm leading-tight text-muted-foreground">{person.position || person.area}</span>
      <span className="mt-1 text-xs text-muted-foreground">
        {direct} {direct === 1 ? 'direto' : 'diretos'}
        {total > direct && ` · ${total} no total`}
      </span>
    </div>
  );
}

function PersonCard({ person, leads, total, dimmed, onOpen }: { person: HubPerson; leads: number; total: number; dimmed: boolean; onOpen: () => void }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border bg-card p-3', leads > 0 && 'border-primary/20', dimmed && 'opacity-40')}>
      <PersonAvatar person={person} size="md" link />
      <div className="min-w-0 flex-1">
        <Link href={`/pessoas/${person.id}`} className="block truncate font-semibold hover:underline">
          {person.name}
        </Link>
        <div className="truncate text-sm text-muted-foreground">{[person.position, person.area].filter(Boolean).join(' · ')}</div>
      </div>
      {leads > 0 && (
        <button
          type="button"
          onClick={onOpen}
          title={total > leads ? `${leads} diretos, ${total} no total` : `${leads} ${leads === 1 ? 'direto' : 'diretos'}`}
          aria-label={`Ver a equipe de ${person.name}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
        >
          <Users className="h-3.5 w-3.5" /> {total}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Organograma por pessoa (quem reporta a quem), navegável: o topo e quem reporta a ele; o botão de
 * equipe desce um nível, e a trilha sobe. Funciona igual com 10 ou 500 pessoas, sem rolagem lateral.
 */
export function ReportingChart({ people, isDimmed = () => false }: { people: HubPerson[]; isDimmed?: (p: HubPerson) => boolean }) {
  const tops = useMemo(() => topLeaders(people), [people]);
  const topIds = useMemo(() => new Set(tops.map((p) => p.id)), [tops]);
  const { reports, total } = useReports(people, topIds);
  const [focusId, setFocusId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  const focus = focusId ? (people.find((p) => p.id === focusId) ?? null) : null;
  const chain = focus ? managerChain(people, focus.id, topIds).reverse() : [];
  const heads = focus ? [focus] : tops;

  useEffect(() => {
    if (!moved.current) return;
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusId]);

  const open = (id: string | null) => {
    moved.current = true;
    setFocusId(id);
  };

  return (
    <div ref={ref} className="grid scroll-mt-24 gap-4">
      {focus && (
        <nav aria-label="Caminho no organograma" className="flex flex-wrap items-center gap-1 text-sm">
          <button type="button" onClick={() => open(null)} className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            Topo
          </button>
          {chain.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button type="button" onClick={() => open(topIds.has(m.id) ? null : m.id)} className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                {m.name}
              </button>
            </span>
          ))}
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="px-1.5 font-medium">{focus.name}</span>
        </nav>
      )}

      <div className={cn('grid items-start gap-6', heads.length > 1 && 'lg:grid-cols-2', heads.length > 2 && 'xl:grid-cols-3')}>
        {heads.map((head) => {
          const members = reports(head.id);
          return (
            <section key={head.id} className="grid gap-0" aria-label={`Equipe de ${head.name}`}>
              <HeadCard person={head} direct={members.length} total={total(head.id)} />
              {members.length > 0 && (
                <>
                  <span className="mx-auto h-5 w-px bg-border" aria-hidden />
                  <div className={cn('grid gap-2 rounded-xl border border-dashed bg-muted/30 p-2', heads.length === 1 && 'sm:grid-cols-2 xl:grid-cols-3')}>
                    {members.map((m) => (
                      <PersonCard key={m.id} person={m} leads={reports(m.id).length} total={total(m.id)} dimmed={isDimmed(m)} onOpen={() => open(m.id)} />
                    ))}
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
