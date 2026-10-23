"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Anchor as PopoverAnchor } from '@radix-ui/react-popover';
import { ArrowUp, ChevronRight, Maximize2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { childUnits, type OrgUnit } from '@/lib/hub/org-units';
import { groupAssistants, type HubPerson } from '@/lib/hub/people';
import { cn } from '@/lib/utils';
import { PersonAvatar } from './PersonAvatar';

/* ───────────── Árvore de unidades com as pessoas já resolvidas ───────────── */

interface UnitNode {
  unit: OrgUnit;
  parentId: string | null;
  leader?: HubPerson;
  /** Falso quando a unidade tem o mesmo responsável da mãe (não repete o nome na caixa). */
  showLeader: boolean;
  members: HubPerson[];
  children: UnitNode[];
  /** Pessoas da unidade e das de baixo, com os responsáveis (quem está em duas equipes conta uma vez). */
  total: number;
  peopleIds: Set<string>;
}

const byName = (a: HubPerson, b: HubPerson) => a.name.localeCompare(b.name, 'pt-BR');

function buildTree(units: OrgUnit[], people: HubPerson[]): { roots: UnitNode[]; byId: Map<string, UnitNode> } {
  const byIdVeneto = new Map(people.filter((p) => p.idVeneto).map((p) => [p.idVeneto, p]));
  const byId = new Map<string, UnitNode>();
  const make = (unit: OrgUnit, parentId: string | null, parentLeader: string | null): UnitNode => {
    const leader = unit.leaderIdVeneto ? byIdVeneto.get(unit.leaderIdVeneto) : undefined;
    const own = people.filter((p) => p.unitId === unit.id);
    const children = childUnits(units, unit.id)
      .filter((c) => !byId.has(c.id))
      .map((c) => make(c, unit.id, unit.leaderIdVeneto ?? parentLeader));
    // O responsável conta mesmo cadastrado em outra unidade (ex.: sócio que responde pela Expansão).
    const peopleIds = new Set([...own.map((p) => p.id), ...(leader ? [leader.id] : []), ...children.flatMap((c) => [...c.peopleIds])]);
    const node: UnitNode = {
      unit,
      parentId,
      leader,
      showLeader: !!leader && unit.leaderIdVeneto !== parentLeader,
      members: own.filter((p) => p.id !== leader?.id).sort(byName),
      children,
      peopleIds,
      total: peopleIds.size,
    };
    byId.set(unit.id, node);
    return node;
  };
  const roots = childUnits(units, null).map((u) => make(u, null, null));
  return { roots, byId };
}

/** Separa o topo (Diretorias) das Áreas que aparecem abaixo dele. */
function split(roots: UnitNode[]) {
  const tops = roots.filter((r) => r.unit.type === 'diretoria');
  const areas = roots.flatMap((r) => (r.unit.type === 'diretoria' ? r.children : [r]));
  return { tops, areas };
}

const count = (n: number) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`;

function summary(node: UnitNode): string {
  const teams = node.children.length;
  return teams > 0 ? `${count(node.total)} · ${teams} ${teams === 1 ? 'equipe' : 'equipes'}` : count(node.total);
}

function useMediaQuery(query: string): boolean | undefined {
  const [matches, setMatches] = useState<boolean>();
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/* ───────────── Peças comuns ───────────── */

function PersonRow({ person, size = 'sm', detail }: { person: HubPerson; size?: 'xs' | 'sm'; detail?: string }) {
  return (
    <Link href={`/pessoas/${person.id}`} className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted">
      <PersonAvatar person={person} size={size} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-tight">{person.name}</span>
        {(detail ?? person.position) && <span className="block truncate text-xs leading-tight text-muted-foreground">{detail ?? person.position}</span>}
      </span>
    </Link>
  );
}

/** Responsável dentro de uma caixa clicável (sem link, porque a caixa inteira é um botão). */
function LeaderLine({ person }: { person: HubPerson }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-primary/5 px-2 py-1.5" title={person.name}>
      <PersonAvatar person={person} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold leading-tight">{person.name}</span>
        <span className="block text-xs leading-tight text-muted-foreground">Responsável</span>
      </span>
    </div>
  );
}

/** Topo (Diretoria): os sócios lado a lado. */
function TopBand({ node, onSelect }: { node: UnitNode; onSelect: (id: string) => void }) {
  const people = [node.leader, ...node.members].filter((p): p is HubPerson => !!p);
  return (
    <section className="w-full max-w-2xl rounded-xl border border-primary/30 bg-card p-4 text-center shadow-sm">
      <button type="button" onClick={() => onSelect(node.unit.id)} className="text-xs font-bold uppercase tracking-wider text-primary hover:underline">
        {node.unit.name}
      </button>
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

/* ───────────── Hover: prévia rápida da unidade ───────────── */

const PREVIEW_PEOPLE = 8;

function UnitPreview({ node }: { node: UnitNode }) {
  const rest = node.members.length - PREVIEW_PEOPLE;
  const ordered = groupAssistants(node.members).flatMap((g) => [{ person: g.person, assistant: false }, ...g.assistants.map((a) => ({ person: a, assistant: true }))]);
  return (
    <div className="grid gap-2">
      <div>
        <div className="font-headline text-sm font-bold leading-tight">{node.unit.name}</div>
        <div className="text-xs text-muted-foreground">{summary(node)}</div>
      </div>
      {node.leader && <PersonRow person={node.leader} detail="Responsável" />}
      {node.children.length > 0 && (
        <ul className="grid gap-0.5 border-t pt-2">
          {node.children.map((c) => (
            <li key={c.unit.id} className="flex items-baseline justify-between gap-2 px-1.5 text-sm">
              <span className="truncate">{c.unit.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{c.total}</span>
            </li>
          ))}
        </ul>
      )}
      {node.members.length > 0 && (
        <div className="grid gap-0.5 border-t pt-2">
          {ordered.slice(0, PREVIEW_PEOPLE).map(({ person, assistant }) => (
            <div key={person.id} className={cn(assistant && 'ml-4 border-l pl-1')}>
              <PersonRow person={person} size="xs" />
            </div>
          ))}
        </div>
      )}
      <p className="px-1.5 text-xs text-muted-foreground">{rest > 0 ? `+${rest} · clique para ver todos` : 'Clique para abrir'}</p>
    </div>
  );
}

/** Abre a prévia depois de um instante com o mouse parado em cima (não pisca ao atravessar o desenho). */
function useHoverPreview(disabled: boolean) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number>();
  const clear = () => window.clearTimeout(timer.current);
  useEffect(() => clear, []);
  useEffect(() => {
    if (disabled) {
      clear();
      setOpen(false);
    }
  }, [disabled]);
  const show = (e: React.PointerEvent) => {
    if (disabled || e.pointerType !== 'mouse') return;
    clear();
    timer.current = window.setTimeout(() => setOpen(true), 300);
  };
  const hide = () => {
    clear();
    timer.current = window.setTimeout(() => setOpen(false), 150);
  };
  const keep = () => clear();
  const close = () => {
    clear();
    setOpen(false);
  };
  return { open, show, hide, keep, close };
}

/* ───────────── Organograma (telas largas): árvore de cima para baixo, com zoom e arrasto ───────────── */

function UnitBox({ node, selected, dragging, onSelect }: { node: UnitNode; selected: boolean; dragging: boolean; onSelect: (id: string) => void }) {
  const hover = useHoverPreview(dragging || selected);
  return (
    <Popover open={hover.open}>
      <PopoverAnchor asChild>
        <button
          type="button"
          onPointerEnter={hover.show}
          onPointerLeave={hover.hide}
          onClick={() => {
            hover.close();
            onSelect(node.unit.id);
          }}
          aria-pressed={selected}
          className={cn(
            'w-full min-w-0 overflow-hidden rounded-xl border p-3 text-left transition-colors hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            node.unit.type === 'equipe' ? 'bg-background' : 'bg-card shadow-sm',
            selected && 'border-primary ring-4 ring-primary/10',
          )}
        >
          <div className={cn('font-headline font-bold leading-tight', node.unit.type === 'equipe' ? 'text-sm' : 'text-[15px]')}>{node.unit.name}</div>
          {node.showLeader && node.leader && (
            <div className="mt-2">
              <LeaderLine person={node.leader} />
            </div>
          )}
          <div className="mt-2 text-xs text-muted-foreground">{summary(node)}</div>
        </button>
      </PopoverAnchor>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="w-72 p-3"
        onPointerEnter={hover.keep}
        onPointerLeave={hover.hide}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={hover.close}
      >
        <UnitPreview node={node} />
      </PopoverContent>
    </Popover>
  );
}

const BRANCH =
  "relative px-2 pt-6 before:absolute before:right-1/2 before:top-0 before:h-6 before:w-1/2 before:border-t before:border-border before:content-[''] after:absolute after:left-1/2 after:top-0 after:h-6 after:w-1/2 after:border-l after:border-t after:border-border after:content-[''] first:before:border-0 last:after:border-0 last:before:border-r only:before:hidden only:after:border-t-0";

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.25;
const clamp = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

function OrgChart({ roots, selectedId, onSelect }: { roots: UnitNode[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const { tops, areas } = split(roots);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [edges, setEdges] = useState({ left: false, right: false });
  const [dragging, setDragging] = useState(false);
  const fitted = useRef(false);

  // Tamanho do desenho sem escala (a transformação não muda o layout, então offsetWidth é o natural).
  useLayoutEffect(() => {
    const el = content.current;
    if (!el) return;
    const measure = () => setNatural({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const vp = viewport.current;
    if (!vp || !natural.w) return;
    setZoom(clamp(Math.min(1, (vp.clientWidth - 32) / natural.w)));
  }, [natural.w]);

  // Primeira abertura: cabe na largura. Depois a pessoa manda no zoom.
  useEffect(() => {
    if (fitted.current || !natural.w) return;
    fitted.current = true;
    fit();
  }, [natural.w, fit]);

  const updateEdges = useCallback(() => {
    const vp = viewport.current;
    if (!vp) return;
    setEdges({ left: vp.scrollLeft > 2, right: vp.scrollLeft + vp.clientWidth < vp.scrollWidth - 2 });
  }, []);
  useEffect(updateEdges, [zoom, natural, updateEdges]);
  useEffect(() => {
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [updateEdges]);

  // Arrastar com o mouse no fundo move o desenho (as caixas continuam clicáveis).
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('a,button')) return;
    const vp = viewport.current!;
    drag.current = { x: e.clientX, y: e.clientY, left: vp.scrollLeft, top: vp.scrollTop };
    vp.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const vp = viewport.current!;
    vp.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
    vp.scrollTop = drag.current.top - (e.clientY - drag.current.y);
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  return (
    <div className="relative min-w-0">
      <div
        ref={viewport}
        onScroll={updateEdges}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="h-[calc(100dvh-9.5rem)] min-h-[420px] min-w-0 overflow-auto rounded-xl border bg-muted/20 p-4 [cursor:grab] active:[cursor:grabbing]"
      >
        <div className="mx-auto" style={{ width: natural.w * zoom || undefined, height: natural.h * zoom || undefined }}>
          <div ref={content} className="w-max origin-top-left" style={{ transform: `scale(${zoom})` }}>
            <div className="flex flex-col items-center">
              {tops.map((t) => (
                <TopBand key={t.unit.id} node={t} onSelect={onSelect} />
              ))}
              {tops.length > 0 && areas.length > 0 && <span className="h-6 w-px bg-border" aria-hidden />}
              <ul className="flex items-start">
                {areas.map((a) => (
                  <li key={a.unit.id} className={BRANCH}>
                    <div className="flex w-52 min-w-0 flex-col">
                      <UnitBox node={a} selected={selectedId === a.unit.id} dragging={dragging} onSelect={onSelect} />
                      {a.children.length > 0 && (
                        <div className="ml-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 border-l pl-3 pt-2">
                          {a.children.map((c) => (
                            <div key={c.unit.id} className="relative min-w-0 before:absolute before:-left-3 before:top-6 before:w-3 before:border-t before:border-border before:content-['']">
                              <UnitBox node={c} selected={selectedId === c.unit.id} dragging={dragging} onSelect={onSelect} />
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
        </div>
      </div>

      {/* Sombras nas bordas: há mais desenho para aquele lado. */}
      <div aria-hidden className={cn('pointer-events-none absolute inset-y-0 left-0 w-8 rounded-l-xl bg-gradient-to-r from-background/90 to-transparent transition-opacity', edges.left ? 'opacity-100' : 'opacity-0')} />
      <div aria-hidden className={cn('pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-xl bg-gradient-to-l from-background/90 to-transparent transition-opacity', edges.right ? 'opacity-100' : 'opacity-0')} />

      {/* Zoom flutuando sobre o desenho, para não gastar uma linha da página. */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border bg-card/95 p-1 text-sm shadow-md backdrop-blur" role="group" aria-label="Zoom">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => clamp(z - 0.1))} disabled={zoom <= ZOOM_MIN} aria-label="Diminuir">
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-11 text-center tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => clamp(z + 0.1))} disabled={zoom >= ZOOM_MAX} aria-label="Aumentar">
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={fit} title="Ajustar à largura da tela">
          <Maximize2 className="mr-1.5 h-3.5 w-3.5" /> Ajustar
        </Button>
      </div>
    </div>
  );
}

/* ───────────── Árvore (telas estreitas): a mesma hierarquia, de cima para baixo ───────────── */

function TreeView({ roots, onSelect }: { roots: UnitNode[]; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(roots.map((r) => r.unit.id)));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const subtitle = (node: UnitNode) => {
    if (node.unit.type === 'diretoria' && node.members.length > 0) return node.members.map((m) => m.name).join(', ');
    if (node.showLeader && node.leader) return node.leader.name;
    return '';
  };

  const Row = ({ node, depth }: { node: UnitNode; depth: number }) => {
    const isOpen = open.has(node.unit.id);
    const hasChildren = node.children.length > 0;
    const sub = subtitle(node);
    return (
      <li>
        <div className={cn('flex items-center gap-1 rounded-md', depth === 0 && 'bg-muted/40')} style={{ paddingLeft: 4 + depth * 18 }}>
          <button
            type="button"
            onClick={() => toggle(node.unit.id)}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Recolher' : 'Expandir'}
            disabled={!hasChildren}
            className="flex h-10 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted disabled:opacity-0"
          >
            <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
          </button>
          <button type="button" onClick={() => onSelect(node.unit.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-2 text-left hover:bg-muted">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold leading-tight">{node.unit.name}</span>
              {sub && <span className="block truncate text-xs leading-tight text-muted-foreground">{sub}</span>}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{node.total}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
        {isOpen && hasChildren && (
          <ul>
            {node.children.map((c) => (
              <Row key={c.unit.id} node={c} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <ul className="rounded-xl border bg-card p-1 shadow-sm">
      {roots.map((r) => (
        <Row key={r.unit.id} node={r} depth={0} />
      ))}
    </ul>
  );
}

/* ───────────── Modal de uma unidade: responsável, equipes e pessoas ───────────── */

function UnitPanel({ node, byId, onSelect }: { node: UnitNode; byId: Map<string, UnitNode>; onSelect: (id: string) => void }) {
  const trail: UnitNode[] = [];
  for (let p = node.parentId ? byId.get(node.parentId) : undefined; p; p = p.parentId ? byId.get(p.parentId) : undefined) trail.unshift(p);
  const parent = trail[trail.length - 1];
  return (
    <>
      <DialogHeader className="text-left">
        {trail.length > 0 && (
          <nav aria-label="Caminho" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {trail.map((t, i) => (
              <span key={t.unit.id} className="inline-flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                <button type="button" onClick={() => onSelect(t.unit.id)} className="rounded px-1 hover:bg-muted hover:text-foreground">
                  {t.unit.name}
                </button>
              </span>
            ))}
          </nav>
        )}
        <DialogTitle className="font-headline text-xl">{node.unit.name}</DialogTitle>
        <DialogDescription>{summary(node)}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <section>
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Responsável</h4>
          {node.leader ? (
            <PersonRow person={node.leader} detail={node.leader.position || undefined} />
          ) : (
            <p className="px-1.5 text-sm text-muted-foreground">Ainda não definido{parent?.leader ? `; vale o de ${parent.unit.name} (${parent.leader.name})` : ''}.</p>
          )}
        </section>

        {node.children.length > 0 && (
          <section>
            <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Equipes</h4>
            <ul className="grid gap-1 sm:grid-cols-2">
              {node.children.map((c) => (
                <li key={c.unit.id}>
                  <button type="button" onClick={() => onSelect(c.unit.id)} className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left hover:bg-muted">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium leading-tight">{c.unit.name}</span>
                      {c.leader && <span className="block truncate text-xs leading-tight text-muted-foreground">{c.leader.name}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{c.total}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(node.members.length > 0 || node.children.length === 0) && (
          <section>
            <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {node.children.length > 0 ? 'Direto na unidade' : 'Pessoas'} · {node.members.length}
            </h4>
            {node.members.length === 0 ? (
              <p className="px-1.5 text-sm text-muted-foreground">Ninguém cadastrado diretamente aqui.</p>
            ) : (
              <ul className="grid items-start gap-x-2 gap-y-0.5 sm:grid-cols-2">
                {groupAssistants(node.members).map(({ person, assistants }) => (
                  <li key={person.id}>
                    <PersonRow person={person} detail={[person.position, person.city].filter(Boolean).join(' · ') || undefined} />
                    {assistants.length > 0 && (
                      <ul className="ml-5 border-l pl-1.5" aria-label={`Assistentes de ${person.name}`}>
                        {assistants.map((a) => (
                          <li key={a.id}>
                            <PersonRow person={a} size="xs" detail={a.position || 'Assistente'} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {parent && (
          <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => onSelect(parent.unit.id)}>
            <ArrowUp className="mr-2 h-4 w-4" /> Subir para {parent.unit.name}
          </Button>
        )}
      </div>
    </>
  );
}

/* ───────────── Vista por estrutura ───────────── */

/**
 * Organograma pela estrutura (ADR 0004): Diretoria › Área › Equipe. Largo: desenho com zoom, prévia
 * ao passar o mouse e modal ao clicar; estreito: árvore e modal ao tocar.
 */
export function OrgStructureView({ units, people, canEdit = false }: { units: OrgUnit[]; people: HubPerson[]; canEdit?: boolean }) {
  const { roots, byId } = useMemo(() => buildTree(units, people), [units, people]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;
  const wide = useMediaQuery('(min-width: 1024px)');
  const unassigned = people.filter((p) => !p.unitId).length;
  const withLeader = units.filter((u) => u.leaderIdVeneto).length;

  return (
    <div className="grid min-w-0 gap-3">
      {canEdit && withLeader === 0 && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Nenhuma unidade tem responsável ainda. Em{' '}
          <Link href="/pessoas/estrutura" className="font-medium text-primary hover:underline">
            Editar estrutura
          </Link>
          , encaixe as unidades e defina os responsáveis.
        </p>
      )}

      {wide === undefined ? null : wide ? (
        <OrgChart roots={roots} selectedId={selectedId} onSelect={setSelectedId} />
      ) : (
        <TreeView roots={roots} onSelect={setSelectedId} />
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
          {selected && <UnitPanel node={selected} byId={byId} onSelect={setSelectedId} />}
        </DialogContent>
      </Dialog>

      {unassigned > 0 && (
        <p className="text-sm text-muted-foreground">
          {unassigned} {unassigned === 1 ? 'pessoa ainda não está' : 'pessoas ainda não estão'} em nenhuma unidade (aparecem na busca).
        </p>
      )}
    </div>
  );
}
