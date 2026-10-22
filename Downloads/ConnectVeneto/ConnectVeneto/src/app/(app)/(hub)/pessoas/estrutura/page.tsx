"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, FolderTree, Loader2, Lock, Plus, Trash2, UserMinus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layout/PageHeader';
import { HubPage } from '@/components/hub-feed/HubPage';
import { PersonAvatar } from '@/components/hub-feed/PersonAvatar';
import { toast } from '@/hooks/use-toast';
import { useHubPeople } from '@/hooks/useHubPeople';
import { useCanEditStructure, useOrgUnitActions, useOrgUnits } from '@/hooks/useOrgUnits';
import { canBeChildOf, childUnits, isSameOrDescendant, unitPathLabel, UNIT_TYPE_LABEL, UNIT_TYPES, type OrgUnit, type UnitType } from '@/lib/hub/org-units';
import type { HubPerson } from '@/lib/hub/people';
import { cn } from '@/lib/utils';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const NEXT_TYPE: Record<UnitType, UnitType> = { diretoria: 'area', area: 'equipe', equipe: 'equipe' };

function useRun() {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await fn();
      if (success) toast({ title: success });
      return true;
    } catch (e) {
      toast({ title: 'Não deu certo', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

function Tree({ units, parentId, selected, onSelect, counts, depth = 0 }: { units: OrgUnit[]; parentId: string | null; selected: string | null; onSelect: (id: string) => void; counts: Map<string, number>; depth?: number }) {
  const children = childUnits(units, parentId);
  if (children.length === 0) return null;
  return (
    <ul className={cn('grid gap-0.5', depth > 0 && 'ml-4 border-l pl-2')}>
      {children.map((u) => (
        <li key={u.id}>
          <button
            type="button"
            onClick={() => onSelect(u.id)}
            className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', selected === u.id && 'bg-primary/10 font-semibold text-primary')}
          >
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{UNIT_TYPE_LABEL[u.type]}</span>
            <span className="min-w-0 flex-1 truncate">{u.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{counts.get(u.id) ?? 0}</span>
          </button>
          <Tree units={units} parentId={u.id} selected={selected} onSelect={onSelect} counts={counts} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

function PersonSelect({ people, value, onChange, placeholder, disabled }: { people: HubPerson[]; value: string; onChange: (v: string) => void; placeholder: string; disabled?: boolean }) {
  return (
    <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {people
        .filter((p) => p.idVeneto)
        .map((p) => (
          <option key={p.id} value={p.idVeneto}>
            {p.name} · {p.position}
          </option>
        ))}
    </select>
  );
}

function UnitSelect({ units, byId, value, onChange, placeholder, exclude, disabled }: { units: OrgUnit[]; byId: Map<string, OrgUnit>; value: string; onChange: (v: string) => void; placeholder: string; exclude?: string; disabled?: boolean }) {
  const options = [...units].filter((u) => u.id !== exclude).sort((a, b) => unitPathLabel(byId, a.id).localeCompare(unitPathLabel(byId, b.id), 'pt-BR'));
  return (
    <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {options.map((u) => (
        <option key={u.id} value={u.id}>
          {unitPathLabel(byId, u.id)}
        </option>
      ))}
    </select>
  );
}

/** Formulário de nova unidade (no topo ou dentro da selecionada). */
function NewUnit({ parent, onCreated, onCancel }: { parent: OrgUnit | null; onCreated: (id: string) => void; onCancel: () => void }) {
  const { createUnit } = useOrgUnitActions();
  const { busy, run } = useRun();
  const allowed = UNIT_TYPES.filter((t) => canBeChildOf(t, parent?.type ?? null));
  const [name, setName] = useState('');
  const [type, setType] = useState<UnitType>(parent ? NEXT_TYPE[parent.type] : 'diretoria');
  useEffect(() => {
    if (!allowed.includes(type)) setType(allowed[0]);
  }, [allowed, type]);
  if (allowed.length === 0) return <p className="text-sm text-muted-foreground">Uma Equipe não tem unidades dentro.</p>;
  return (
    <form
      className="grid gap-3 rounded-lg border border-dashed p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          const id = await createUnit({ name: name.trim(), type, parentId: parent?.id ?? null, leaderIdVeneto: null });
          onCreated(id);
        }, 'Unidade criada');
      }}
    >
      <p className="text-sm font-medium">{parent ? `Nova unidade dentro de ${parent.name}` : 'Nova unidade no topo'}</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex.: Mesa de operações)" aria-label="Nome da unidade" />
        <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as UnitType)} aria-label="Tipo">
          {allowed.map((t) => (
            <option key={t} value={t}>
              {UNIT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy || !name.trim()}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function UnitPanel({ unit, units, byId, people, onDeleted, onSelect }: { unit: OrgUnit; units: OrgUnit[]; byId: Map<string, OrgUnit>; people: HubPerson[]; onDeleted: () => void; onSelect: (id: string) => void }) {
  const { updateUnit, deleteUnit, setPersonUnit } = useOrgUnitActions();
  const { busy, run } = useRun();
  const [name, setName] = useState(unit.name);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    setName(unit.name);
    setCreating(false);
  }, [unit.id, unit.name]);

  const members = people.filter((p) => p.unitId === unit.id).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const outside = people.filter((p) => p.unitId !== unit.id);
  const validParents = units.filter((u) => u.id !== unit.id && !isSameOrDescendant(byId, u.id, unit.id) && canBeChildOf(unit.type, u.type));
  const leader = people.find((p) => p.idVeneto && p.idVeneto === unit.leaderIdVeneto);

  return (
    <section className="grid content-start gap-5 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{UNIT_TYPE_LABEL[unit.type]}</div>
          <h2 className="font-headline text-xl font-bold">{unit.name}</h2>
          {unit.parentId && <p className="text-sm text-muted-foreground">{unitPathLabel(byId, unit.parentId)}</p>}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => {
            if (!window.confirm(`Excluir "${unit.name}"? Só dá para excluir unidade vazia.`)) return;
            void run(async () => {
              await deleteUnit(unit.id);
              onDeleted();
            }, 'Unidade excluída');
          }}
        >
          <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="unit-name">Nome</Label>
          <div className="flex gap-2">
            <Input id="unit-name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button size="sm" variant="outline" className="h-10" disabled={busy || !name.trim() || name.trim() === unit.name} onClick={() => void run(() => updateUnit(unit.id, { name: name.trim() }), 'Nome salvo')}>
              Salvar
            </Button>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="unit-type">Tipo</Label>
          <select id="unit-type" className={selectClass} value={unit.type} disabled={busy} onChange={(e) => void run(() => updateUnit(unit.id, { type: e.target.value as UnitType }), 'Tipo alterado')}>
            {UNIT_TYPES.map((t) => (
              <option key={t} value={t}>
                {UNIT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="unit-parent">Fica dentro de</Label>
          <select id="unit-parent" className={selectClass} value={unit.parentId ?? ''} disabled={busy} onChange={(e) => void run(() => updateUnit(unit.id, { parentId: e.target.value || null }), 'Unidade movida')}>
            <option value="">— topo da estrutura —</option>
            {validParents
              .sort((a, b) => unitPathLabel(byId, a.id).localeCompare(unitPathLabel(byId, b.id), 'pt-BR'))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {unitPathLabel(byId, u.id)}
                </option>
              ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label>Responsável</Label>
          <PersonSelect people={people} value={unit.leaderIdVeneto ?? ''} disabled={busy} placeholder="— sem responsável —" onChange={(v) => void run(() => updateUnit(unit.id, { leaderIdVeneto: v || null }), 'Responsável salvo')} />
          <p className="text-xs text-muted-foreground">
            {leader ? `Quem está aqui reporta a ${leader.name.split(' ')[0]}.` : 'Sem responsável, quem está aqui reporta ao responsável da unidade de cima.'}
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4 text-primary" /> Pessoas nesta unidade · {members.length}
          </h3>
          <div className="w-full max-w-xs">
            <PersonSelect
              people={outside}
              value=""
              disabled={busy}
              placeholder="+ adicionar pessoa…"
              onChange={(idVeneto) => {
                const p = outside.find((x) => x.idVeneto === idVeneto);
                if (p) void run(() => setPersonUnit(p.id, unit.id), `${p.name.split(' ')[0]} entrou em ${unit.name}`);
              }}
            />
          </div>
        </div>
        {members.length === 0 && <p className="text-sm text-muted-foreground">Ninguém ainda. Adicione acima ou pela bandeja &quot;Sem unidade&quot;.</p>}
        <ul className="grid gap-1">
          {members.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2">
              <PersonAvatar person={p} size="sm" link />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block truncate text-sm text-muted-foreground">{p.position}</span>
              </span>
              <div className="w-56">
                <UnitSelect units={units} byId={byId} value="" exclude={unit.id} disabled={busy} placeholder="mover para…" onChange={(to) => to && void run(() => setPersonUnit(p.id, to), `${p.name.split(' ')[0]} movido(a)`)} />
              </div>
              <Button size="icon" variant="ghost" className="h-9 w-9" aria-label={`Tirar ${p.name} da unidade`} disabled={busy} onClick={() => void run(() => setPersonUnit(p.id, ''), `${p.name.split(' ')[0]} ficou sem unidade`)}>
                <UserMinus className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-2">
        {childUnits(units, unit.id).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {childUnits(units, unit.id).map((c) => (
              <button key={c.id} type="button" onClick={() => onSelect(c.id)} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm hover:bg-muted">
                {c.name} <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}
        {creating ? (
          <NewUnit parent={unit} onCancel={() => setCreating(false)} onCreated={(id) => onSelect(id)} />
        ) : (
          unit.type !== 'equipe' && (
            <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setCreating(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova unidade dentro de {unit.name}
            </Button>
          )
        )}
      </div>
    </section>
  );
}

/**
 * Estrutura organizacional (ADR 0004): o RH monta Diretoria › Área › Equipe, define o responsável de
 * cada unidade e encaixa as pessoas. O gestor de cada pessoa passa a vir daqui.
 */
export default function EstruturaPage() {
  const canEdit = useCanEditStructure();
  const { units, byId, loading } = useOrgUnits();
  const { people } = useHubPeople();
  const { setPersonUnit } = useOrgUnitActions();
  const { busy, run } = useRun();
  const [selected, setSelected] = useState<string | null>(null);
  const [creatingTop, setCreatingTop] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of people) if (p.unitId) m.set(p.unitId, (m.get(p.unitId) ?? 0) + 1);
    return m;
  }, [people]);
  const unassigned = people.filter((p) => !p.unitId).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const unit = selected ? byId.get(selected) ?? null : null;

  if (!canEdit) {
    return (
      <HubPage>
        <div className="flex items-start gap-3 rounded-xl border bg-card p-5">
          <Lock className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <p>A estrutura é mantida pelo RH. Para ver as áreas e equipes, use o <Link href="/pessoas" className="font-medium text-primary hover:underline">organograma</Link>.</p>
        </div>
      </HubPage>
    );
  }

  return (
    <HubPage className="max-w-none md:mx-0">
      <PageHeader title="Estrutura" description="Diretorias, áreas e equipes. Cada pessoa reporta ao responsável da sua unidade; o responsável reporta ao da unidade de cima." />

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="grid content-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 font-headline text-base font-semibold">
              <FolderTree className="h-4 w-4 text-primary" /> Unidades
            </h2>
            <Button size="sm" variant="outline" onClick={() => setCreatingTop(true)}>
              <Plus className="mr-1 h-4 w-4" /> Nova
            </Button>
          </div>
          {creatingTop && (
            <NewUnit
              parent={null}
              onCancel={() => setCreatingTop(false)}
              onCreated={(id) => {
                setCreatingTop(false);
                setSelected(id);
              }}
            />
          )}
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {!loading && units.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma unidade ainda. Comece criando uma Diretoria ou Área.</p>}
          <Tree units={units} parentId={null} selected={selected} onSelect={setSelected} counts={counts} />
        </aside>

        <div className="grid content-start gap-6">
          {unit ? (
            <UnitPanel unit={unit} units={units} byId={byId} people={people} onDeleted={() => setSelected(null)} onSelect={setSelected} />
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-muted-foreground">Escolha uma unidade à esquerda para editar o nome, o responsável e as pessoas.</p>
          )}

          <section className="grid gap-2 rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="font-headline text-base font-semibold">Sem unidade · {unassigned.length}</h3>
            <p className="text-sm text-muted-foreground">Enquanto não estão numa unidade, estas pessoas seguem com o gestor do cadastro.</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {unassigned.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <PersonAvatar person={p} size="sm" link />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[p.position, p.area].filter(Boolean).join(' · ')}</span>
                  </span>
                  <div className="w-44">
                    <UnitSelect units={units} byId={byId} value="" disabled={busy || units.length === 0} placeholder="colocar em…" onChange={(to) => to && void run(() => setPersonUnit(p.id, to), `${p.name.split(' ')[0]} encaixado(a)`)} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </HubPage>
  );
}
