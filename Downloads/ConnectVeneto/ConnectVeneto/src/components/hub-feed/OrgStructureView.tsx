"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { childUnits, UNIT_TYPE_LABEL, type OrgUnit } from '@/lib/hub/org-units';
import type { HubPerson } from '@/lib/hub/people';
import { cn } from '@/lib/utils';
import { PersonAvatar } from './PersonAvatar';

const STACK = 8;

function countIn(units: OrgUnit[], people: HubPerson[], unitId: string): number {
  return people.filter((p) => p.unitId === unitId).length + childUnits(units, unitId).reduce((n, c) => n + countIn(units, people, c.id), 0);
}

function MemberList({ members }: { members: HubPerson[] }) {
  return (
    <ul className="grid gap-0.5">
      {members.map((m) => (
        <li key={m.id}>
          <Link href={`/pessoas/${m.id}`} className="flex items-center gap-2.5 rounded-md p-1.5 hover:bg-muted">
            <PersonAvatar person={m} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{m.name}</span>
              {m.position && <span className="block truncate text-xs text-muted-foreground">{m.position}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function UnitCard({ unit, units, people, depth }: { unit: OrgUnit; units: OrgUnit[]; people: HubPerson[]; depth: number }) {
  const [open, setOpen] = useState(false);
  const leader = people.find((p) => p.idVeneto && p.idVeneto === unit.leaderIdVeneto);
  const members = people.filter((p) => p.unitId === unit.id && p.id !== leader?.id).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const children = childUnits(units, unit.id);
  const total = countIn(units, people, unit.id);

  return (
    <section className={cn('grid gap-3 rounded-xl border p-4', depth === 0 ? 'bg-card shadow-sm' : 'bg-background', children.length > 0 && 'sm:col-span-2 xl:col-span-3')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-primary">{UNIT_TYPE_LABEL[unit.type]}</div>
          <h3 className="font-headline text-base font-bold leading-tight">{unit.name}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground" title="Pessoas na unidade">
          {total} {total === 1 ? 'pessoa' : 'pessoas'}
        </span>
      </div>

      {leader ? (
        <Link href={`/pessoas/${leader.id}`} className="flex items-center gap-2.5 rounded-lg bg-primary/5 p-2 hover:bg-primary/10">
          <PersonAvatar person={leader} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{leader.name}</span>
            <span className="block text-xs text-muted-foreground">Responsável</span>
          </span>
        </Link>
      ) : (
        <p className="text-xs text-muted-foreground">Responsável ainda não definido</p>
      )}

      {members.length > 0 && (
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center justify-between gap-2 rounded-lg p-1 text-left hover:bg-muted"
          >
            <span className="flex items-center">
              <span className="flex -space-x-2">
                {members.slice(0, STACK).map((m) => (
                  <PersonAvatar key={m.id} person={m} size="sm" className="ring-2 ring-card" />
                ))}
              </span>
              {members.length > STACK && <span className="ml-2 text-xs font-medium text-muted-foreground">+{members.length - STACK}</span>}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              {open ? 'Recolher' : 'Ver pessoas'}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
            </span>
          </button>
          {open && <MemberList members={members} />}
        </div>
      )}

      {children.length > 0 && (
        <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {children.map((c) => (
            <UnitCard key={c.id} unit={c} units={units} people={people} depth={depth + 1} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Organograma pela estrutura (ADR 0004): Diretoria › Área › Equipe, com responsável e pessoas (abre no clique). */
export function OrgStructureView({ units, people, canEdit = false }: { units: OrgUnit[]; people: HubPerson[]; canEdit?: boolean }) {
  const top = childUnits(units, null);
  const unassigned = people.filter((p) => !p.unitId).length;
  const withLeader = units.filter((u) => u.leaderIdVeneto).length;
  return (
    <div className="grid gap-4">
      {canEdit && withLeader === 0 && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Nenhuma unidade tem responsável ainda, e todas estão no topo. Em{' '}
          <Link href="/pessoas/estrutura" className="font-medium text-primary hover:underline">
            Editar estrutura
          </Link>
          , crie as Diretorias e Equipes, encaixe as Áreas e defina os responsáveis.
        </p>
      )}
      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {top.map((u) => (
          <UnitCard key={u.id} unit={u} units={units} people={people} depth={0} />
        ))}
      </div>
      {unassigned > 0 && (
        <p className="text-sm text-muted-foreground">
          {unassigned} {unassigned === 1 ? 'pessoa ainda não está' : 'pessoas ainda não estão'} em nenhuma unidade (aparecem na vista &quot;Por liderança&quot; e na busca).
        </p>
      )}
    </div>
  );
}
