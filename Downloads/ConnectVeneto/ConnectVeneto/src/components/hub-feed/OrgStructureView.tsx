"use client";

import Link from 'next/link';
import { childUnits, UNIT_TYPE_LABEL, type OrgUnit } from '@/lib/hub/org-units';
import type { HubPerson } from '@/lib/hub/people';
import { cn } from '@/lib/utils';
import { PersonAvatar } from './PersonAvatar';

function UnitNode({ unit, units, people, depth }: { unit: OrgUnit; units: OrgUnit[]; people: HubPerson[]; depth: number }) {
  const leader = people.find((p) => p.idVeneto && p.idVeneto === unit.leaderIdVeneto);
  const members = people.filter((p) => p.unitId === unit.id && p.id !== leader?.id).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const children = childUnits(units, unit.id);
  return (
    <section className={cn('grid gap-3 rounded-xl border p-4', depth === 0 ? 'bg-card shadow-sm' : 'bg-background')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-primary">{UNIT_TYPE_LABEL[unit.type]}</div>
          <h3 className="font-headline text-base font-bold leading-tight">{unit.name}</h3>
        </div>
        {leader && (
          <Link href={`/pessoas/${leader.id}`} className="inline-flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 text-sm hover:bg-muted">
            <PersonAvatar person={leader} size="sm" />
            <span>
              <span className="font-medium">{leader.name}</span>
              <span className="text-muted-foreground"> · responsável</span>
            </span>
          </Link>
        )}
      </div>
      {members.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <Link key={m.id} href={`/pessoas/${m.id}`} className="inline-flex items-center gap-2 rounded-full bg-muted/60 py-1 pl-1 pr-3 text-sm hover:bg-muted" title={m.position}>
              <PersonAvatar person={m} size="xs" />
              {m.name}
            </Link>
          ))}
        </div>
      )}
      {children.length > 0 && (
        <div className={cn('grid gap-3', depth === 0 && 'md:grid-cols-2 xl:grid-cols-3')}>
          {children.map((c) => (
            <UnitNode key={c.id} unit={c} units={units} people={people} depth={depth + 1} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Organograma pela estrutura (ADR 0004): Diretoria › Área › Equipe, com responsável e pessoas. */
export function OrgStructureView({ units, people }: { units: OrgUnit[]; people: HubPerson[] }) {
  const top = childUnits(units, null);
  const unassigned = people.filter((p) => !p.unitId).length;
  return (
    <div className="grid gap-4">
      {top.map((u) => (
        <UnitNode key={u.id} unit={u} units={units} people={people} depth={0} />
      ))}
      {unassigned > 0 && (
        <p className="text-sm text-muted-foreground">
          {unassigned} {unassigned === 1 ? 'pessoa ainda não está' : 'pessoas ainda não estão'} em nenhuma unidade (aparecem na vista &quot;Por pessoa&quot; e na busca).
        </p>
      )}
    </div>
  );
}
