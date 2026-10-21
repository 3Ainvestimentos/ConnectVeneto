"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { childUnits, UNIT_TYPE_LABEL, type OrgUnit } from '@/lib/hub/org-units';
import type { HubPerson } from '@/lib/hub/people';
import { cn } from '@/lib/utils';
import { PersonAvatar } from './PersonAvatar';

/** Visuais em teste para a vista por estrutura (escolher um e apagar os outros). */
export const STRUCTURE_VARIANTS = [
  ['organograma', 'Organograma'],
  ['arvore', 'Árvore'],
  ['colunas', 'Colunas'],
  ['cartoes', 'Cartões'],
] as const;
export type StructureVariant = (typeof STRUCTURE_VARIANTS)[number][0];

interface UnitNode {
  unit: OrgUnit;
  leader?: HubPerson;
  /** Falso quando a unidade tem o mesmo responsável da mãe (não repete o nome). */
  showLeader: boolean;
  members: HubPerson[];
  children: UnitNode[];
  total: number;
}

const byName = (a: HubPerson, b: HubPerson) => a.name.localeCompare(b.name, 'pt-BR');

function buildTree(units: OrgUnit[], people: HubPerson[]): UnitNode[] {
  const byIdVeneto = new Map(people.filter((p) => p.idVeneto).map((p) => [p.idVeneto, p]));
  const seen = new Set<string>();
  const make = (unit: OrgUnit, parentLeader: string | null): UnitNode => {
    seen.add(unit.id);
    const leader = unit.leaderIdVeneto ? byIdVeneto.get(unit.leaderIdVeneto) : undefined;
    const own = people.filter((p) => p.unitId === unit.id);
    const children = childUnits(units, unit.id)
      .filter((c) => !seen.has(c.id))
      .map((c) => make(c, unit.leaderIdVeneto ?? parentLeader));
    return {
      unit,
      leader,
      showLeader: !!leader && unit.leaderIdVeneto !== parentLeader,
      members: own.filter((p) => p.id !== leader?.id).sort(byName),
      children,
      total: own.length + children.reduce((n, c) => n + c.total, 0),
    };
  };
  return childUnits(units, null).map((u) => make(u, null));
}

const count = (n: number) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`;

function PersonRow({ person, size = 'sm' }: { person: HubPerson; size?: 'xs' | 'sm' }) {
  return (
    <Link href={`/pessoas/${person.id}`} className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted">
      <PersonAvatar person={person} size={size} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-tight">{person.name}</span>
        {person.position && <span className="block truncate text-xs leading-tight text-muted-foreground">{person.position}</span>}
      </span>
    </Link>
  );
}

function LeaderLine({ person }: { person: HubPerson }) {
  return (
    <Link href={`/pessoas/${person.id}`} className="flex items-center gap-2 rounded-lg bg-primary/5 px-2 py-1.5 hover:bg-primary/10">
      <PersonAvatar person={person} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight">{person.name}</span>
        <span className="block text-xs leading-tight text-muted-foreground">Responsável</span>
      </span>
    </Link>
  );
}

/** Topo (Diretoria): os sócios lado a lado. */
function TopBand({ node }: { node: UnitNode }) {
  const people = [node.leader, ...node.members].filter((p): p is HubPerson => !!p);
  return (
    <section className="rounded-xl border border-primary/30 bg-card p-4 text-center shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-primary">{node.unit.name}</div>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        {people.map((p) => (
          <Link key={p.id} href={`/pessoas/${p.id}`} className="flex items-center gap-3 rounded-lg border bg-background py-2 pl-2 pr-4 text-left hover:bg-muted">
            <PersonAvatar person={p} size="md" />
            <span>
              <span className="block font-semibold leading-tight">{p.name}</span>
              <span className="block text-sm leading-tight text-muted-foreground">{p.position}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Separa o topo (Diretorias) das Áreas que aparecem abaixo dele. */
function split(roots: UnitNode[]) {
  const tops = roots.filter((r) => r.unit.type === 'diretoria');
  const areas = roots.flatMap((r) => (r.unit.type === 'diretoria' ? r.children : [r]));
  return { tops, areas };
}

/* ───────────── 1. Organograma: árvore de cima para baixo, com linhas ───────────── */

function OrgBox({ node, className }: { node: UnitNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('rounded-xl border bg-card p-3 text-left shadow-sm', node.unit.type === 'equipe' && 'bg-background shadow-none', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-primary">{UNIT_TYPE_LABEL[node.unit.type]}</div>
          <div className="font-headline text-sm font-bold leading-tight">{node.unit.name}</div>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{node.total}</span>
      </div>
      {node.showLeader && node.leader && (
        <div className="mt-2">
          <LeaderLine person={node.leader} />
        </div>
      )}
      {node.members.length > 0 && (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {open ? 'Recolher' : `Ver ${count(node.members.length)}`}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
          </button>
          {open && (
            <div className="mt-1 grid gap-0.5">
              {node.members.map((m) => (
                <PersonRow key={m.id} person={m} size="xs" />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const BRANCH =
  "relative px-2 pt-6 before:absolute before:right-1/2 before:top-0 before:h-6 before:w-1/2 before:border-t before:border-border before:content-[''] after:absolute after:left-1/2 after:top-0 after:h-6 after:w-1/2 after:border-l after:border-t after:border-border after:content-[''] first:before:border-0 last:after:border-0 last:before:border-r only:before:hidden only:after:border-t-0";

function OrgChart({ roots }: { roots: UnitNode[] }) {
  const { tops, areas } = split(roots);
  const scroller = useRef<HTMLDivElement>(null);
  // Mais largo que a tela: abre centralizado no topo (sócios), e a pessoa rola para os lados.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [areas.length]);
  return (
    <div ref={scroller} className="overflow-x-auto pb-4">
      <div className="mx-auto flex w-max min-w-full flex-col items-center">
        {tops.map((t) => (
          <div key={t.unit.id} className="w-full max-w-2xl">
            <TopBand node={t} />
          </div>
        ))}
        {tops.length > 0 && areas.length > 0 && <span className="h-6 w-px bg-border" aria-hidden />}
        <ul className="flex">
          {areas.map((a) => (
            <li key={a.unit.id} className={BRANCH}>
              <div className="flex w-56 flex-col">
                <OrgBox node={a} />
                {a.children.length > 0 && (
                  <div className="ml-4 grid gap-2 border-l pl-3 pt-2">
                    {a.children.map((c) => (
                      <div key={c.unit.id} className="relative before:absolute before:-left-3 before:top-6 before:w-3 before:border-t before:border-border before:content-['']">
                        <OrgBox node={c} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ───────────── 2. Árvore: lista que abre e fecha, com nomes ───────────── */

function TreeView({ roots }: { roots: UnitNode[] }) {
  const all = useMemo(() => {
    const ids: string[] = [];
    const walk = (n: UnitNode) => {
      ids.push(n.unit.id);
      n.children.forEach(walk);
    };
    roots.forEach(walk);
    return ids;
  }, [roots]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(roots.map((r) => r.unit.id)));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const Row = ({ node, depth }: { node: UnitNode; depth: number }) => {
    const isOpen = open.has(node.unit.id);
    const hasContent = node.children.length > 0 || node.members.length > 0;
    return (
      <li>
        <button
          type="button"
          onClick={() => toggle(node.unit.id)}
          aria-expanded={isOpen}
          disabled={!hasContent}
          className={cn('flex w-full items-center gap-2 rounded-md py-2 pr-3 text-left hover:bg-muted disabled:hover:bg-transparent', depth === 0 && 'bg-muted/40')}
          style={{ paddingLeft: 8 + depth * 22 }}
        >
          <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-90', !hasContent && 'opacity-0')} />
          <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wider text-primary">{UNIT_TYPE_LABEL[node.unit.type]}</span>
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold">{node.unit.name}</span>
            {node.showLeader && node.leader && <span className="text-sm text-muted-foreground"> · {node.leader.name}</span>}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{node.total}</span>
        </button>
        {isOpen && (
          <ul>
            {node.members.length > 0 && (
              <li className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3" style={{ paddingLeft: 30 + (depth + 1) * 22 }}>
                {node.members.map((m) => (
                  <PersonRow key={m.id} person={m} size="xs" />
                ))}
              </li>
            )}
            {node.children.map((c) => (
              <Row key={c.unit.id} node={c} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="grid gap-2">
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(new Set(all))}>
          Expandir tudo
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(new Set())}>
          Recolher tudo
        </Button>
      </div>
      <ul className="rounded-xl border bg-card p-2 shadow-sm">
        {roots.map((r) => (
          <Row key={r.unit.id} node={r} depth={0} />
        ))}
      </ul>
    </div>
  );
}

/* ───────────── 3. Colunas: uma caixa por Área, nomes já à vista ───────────── */

function ColumnsView({ roots }: { roots: UnitNode[] }) {
  const { tops, areas } = split(roots);
  return (
    <div className="grid gap-4">
      {tops.map((t) => (
        <TopBand key={t.unit.id} node={t} />
      ))}
      <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
        {areas.map((a) => (
          <section key={a.unit.id} className="mb-4 grid break-inside-avoid gap-2 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-primary">{UNIT_TYPE_LABEL[a.unit.type]}</div>
                <h3 className="font-headline text-base font-bold leading-tight">{a.unit.name}</h3>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{count(a.total)}</span>
            </div>
            {a.showLeader && a.leader && <LeaderLine person={a.leader} />}
            {a.members.length > 0 && (
              <div className="grid gap-0.5">
                {a.members.map((m) => (
                  <PersonRow key={m.id} person={m} size="xs" />
                ))}
              </div>
            )}
            {a.children.map((c) => (
              <div key={c.unit.id} className="grid gap-1 border-t pt-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold">{c.unit.name}</span>
                  <span className="text-xs text-muted-foreground">{c.total}</span>
                </div>
                {c.showLeader && c.leader && <div className="text-xs text-muted-foreground">Responsável: {c.leader.name}</div>}
                <div className="grid gap-0.5">
                  {c.members.map((m) => (
                    <PersonRow key={m.id} person={m} size="xs" />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/* ───────────── 4. Cartões: grade de cartões, pessoas abrem no clique ───────────── */

const STACK = 8;

function UnitCard({ node, depth }: { node: UnitNode; depth: number }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={cn('grid gap-3 rounded-xl border p-4', depth === 0 ? 'bg-card shadow-sm' : 'bg-background', node.children.length > 0 && 'sm:col-span-2 xl:col-span-3')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-primary">{UNIT_TYPE_LABEL[node.unit.type]}</div>
          <h3 className="font-headline text-base font-bold leading-tight">{node.unit.name}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{count(node.total)}</span>
      </div>
      {node.showLeader && node.leader && <LeaderLine person={node.leader} />}
      {node.members.length > 0 && (
        <div className="grid gap-2">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center justify-between gap-2 rounded-lg p-1 text-left hover:bg-muted">
            <span className="flex items-center">
              <span className="flex -space-x-2">
                {node.members.slice(0, STACK).map((m) => (
                  <PersonAvatar key={m.id} person={m} size="sm" className="ring-2 ring-card" />
                ))}
              </span>
              {node.members.length > STACK && <span className="ml-2 text-xs font-medium text-muted-foreground">+{node.members.length - STACK}</span>}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              {open ? 'Recolher' : 'Ver pessoas'}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
            </span>
          </button>
          {open && (
            <div className="grid gap-0.5">
              {node.members.map((m) => (
                <PersonRow key={m.id} person={m} />
              ))}
            </div>
          )}
        </div>
      )}
      {node.children.length > 0 && (
        <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {node.children.map((c) => (
            <UnitCard key={c.unit.id} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </section>
  );
}

function CardsView({ roots }: { roots: UnitNode[] }) {
  const { tops, areas } = split(roots);
  return (
    <div className="grid gap-4">
      {tops.map((t) => (
        <TopBand key={t.unit.id} node={t} />
      ))}
      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* Áreas sem Equipes antes: os cartões pequenos enchem a grade e as grandes vêm inteiras depois. */}
        {[...areas]
          .sort((a, b) => Number(a.children.length > 0) - Number(b.children.length > 0))
          .map((a) => (
            <UnitCard key={a.unit.id} node={a} depth={0} />
          ))}
      </div>
    </div>
  );
}

/** Organograma pela estrutura (ADR 0004): Diretoria › Área › Equipe, com responsável e pessoas. */
export function OrgStructureView({
  units,
  people,
  canEdit = false,
  variant = 'organograma',
}: {
  units: OrgUnit[];
  people: HubPerson[];
  canEdit?: boolean;
  variant?: StructureVariant;
}) {
  const roots = useMemo(() => buildTree(units, people), [units, people]);
  const unassigned = people.filter((p) => !p.unitId).length;
  const withLeader = units.filter((u) => u.leaderIdVeneto).length;
  const View = { organograma: OrgChart, arvore: TreeView, colunas: ColumnsView, cartoes: CardsView }[variant];
  return (
    <div className="grid gap-4">
      {canEdit && withLeader === 0 && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Nenhuma unidade tem responsável ainda. Em{' '}
          <Link href="/pessoas/estrutura" className="font-medium text-primary hover:underline">
            Editar estrutura
          </Link>
          , encaixe as unidades e defina os responsáveis.
        </p>
      )}
      <View roots={roots} />
      {unassigned > 0 && (
        <p className="text-sm text-muted-foreground">
          {unassigned} {unassigned === 1 ? 'pessoa ainda não está' : 'pessoas ainda não estão'} em nenhuma unidade (aparecem na vista &quot;Por liderança&quot; e na busca).
        </p>
      )}
    </div>
  );
}
