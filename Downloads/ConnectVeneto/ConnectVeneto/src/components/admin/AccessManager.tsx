"use client";

import { useMemo, useState } from 'react';
import { ArrowLeft, Copy, Loader2, Lock, Search, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PersonAvatar } from '@/components/hub-feed/PersonAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators, type Collaborator } from '@/contexts/CollaboratorsContext';
import { hasPerPersonAccess, isEmbeddedModule, moduleViewKey, resolveModuleAccess, type HubModule } from '@/config/modules';
import { toast } from '@/hooks/use-toast';
import { useAccessActions } from '@/hooks/useAccessProfiles';
import { useHubModules } from '@/hooks/useHubModules';
import { useOrgUnits } from '@/hooks/useOrgUnits';
import { DEFAULT_PERMISSIONS, PERMISSION_GROUPS, SYSTEM_PERMISSION_KEYS, type PermissionKey } from '@/lib/access/catalog';
import { unitPathLabel } from '@/lib/hub/org-units';
import { cn } from '@/lib/utils';

/** Itens do menu sem acesso próprio (seguem o do piloto do Início): não aparecem como módulo. */
const SHARED_ACCESS_MODULES = new Set(['pessoas', 'publicacoes']);
const ALL = '__todas__';

const GROUP_TITLE: Record<string, { title: string; hint: string }> = {
  paginas: { title: 'Páginas que a pessoa vê', hint: 'Itens do menu e telas do Connect.' },
  gestao: { title: 'O que a pessoa administra', hint: 'Cadastros e publicações que ela pode criar ou mudar.' },
  sistema: { title: 'Sistema', hint: 'Só um super admin liga ou desliga.' },
};

type ModuleValue = string[] | null; // null = sem registro (padrão do módulo)
interface Draft {
  permissions: Record<PermissionKey, boolean>;
  modules: Record<string, ModuleValue>;
}

function useAccessModules(): HubModule[] {
  const { modules } = useHubModules();
  return useMemo(() => modules.filter((m) => m.enabled && hasPerPersonAccess(m) && !SHARED_ACCESS_MODULES.has(m.id)), [modules]);
}

const draftOf = (c: Collaborator, modules: HubModule[]): Draft => ({
  permissions: { ...DEFAULT_PERMISSIONS, ...(c.permissions ?? {}) } as Record<PermissionKey, boolean>,
  modules: Object.fromEntries(modules.map((m) => [m.id, c.modulePermissions?.[m.id] ?? null])),
});

const sameList = (a: ModuleValue, b: ModuleValue) => (a === null || b === null ? a === b : [...a].sort().join('|') === [...b].sort().join('|'));

/* ───────────── Editor de uma pessoa ───────────── */

function ModuleCard({ mod, value, onChange }: { mod: HubModule; value: ModuleValue; onChange: (v: ModuleValue) => void }) {
  const access = resolveModuleAccess(mod, value ?? undefined);
  const viewKey = moduleViewKey(mod.id);
  const catalog = isEmbeddedModule(mod) ? mod.permissionCatalog.filter((p) => p.key !== viewKey) : [];
  const toggle = (on: boolean) => {
    if (!on) return onChange([]);
    // Módulo aberto a todos: voltar ao padrão; restrito: só a entrada.
    onChange(mod.accessMode === 'all' ? null : [viewKey]);
  };
  const toggleSub = (key: string) => {
    const list = new Set(access.permissions.length ? access.permissions : [viewKey]);
    list.add(viewKey);
    if (list.has(key)) list.delete(key);
    else list.add(key);
    onChange([...list]);
  };
  return (
    <div className={cn('grid gap-2 rounded-lg border p-3', access.hasAccess ? 'bg-card' : 'bg-muted/30')}>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-medium">{mod.label}</span>
          <span className="block text-xs text-muted-foreground">{access.hasAccess ? 'Tem acesso' : 'Sem acesso'}{mod.accessMode === 'all' && value === null ? ' (padrão: todos acessam)' : ''}</span>
        </span>
        <Switch checked={access.hasAccess} onCheckedChange={toggle} aria-label={`Acesso ao ${mod.label}`} />
      </div>
      {access.hasAccess && catalog.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {catalog.map((p) => {
            const on = access.permissions.includes(p.key);
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggleSub(p.key)}
                className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors', on ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PersonEditor({ person, people, onBack }: { person: Collaborator; people: Collaborator[]; onBack: () => void }) {
  const { isSuperAdmin } = useAuth();
  const { byId: units } = useOrgUnits();
  const modules = useAccessModules();
  const { setPersonAccess } = useAccessActions();
  const original = useMemo(() => draftOf(person, modules), [person, modules]);
  const [draft, setDraft] = useState<Draft>(original);
  const [saving, setSaving] = useState(false);

  const changedPerms = (Object.keys(draft.permissions) as PermissionKey[]).filter((k) => draft.permissions[k] !== original.permissions[k]);
  const changedMods = Object.keys(draft.modules).filter((id) => !sameList(draft.modules[id], original.modules[id]));
  const changes = changedPerms.length + changedMods.length;

  const copyFrom = (id: string) => {
    const other = people.find((c) => c.id === id);
    if (!other) return;
    const next = draftOf(other, modules);
    // Acesso ao sistema não é copiado por quem não é super admin.
    if (!isSuperAdmin) for (const k of SYSTEM_PERMISSION_KEYS) next.permissions[k] = draft.permissions[k];
    setDraft(next);
    toast({ title: `Acesso de ${other.name} copiado`, description: 'Confira e salve para valer.' });
  };

  const save = async () => {
    setSaving(true);
    try {
      await setPersonAccess(person.id, {
        ...(changedPerms.length ? { permissions: Object.fromEntries(changedPerms.map((k) => [k, draft.permissions[k]])) } : {}),
        ...(changedMods.length ? { modulePermissions: Object.fromEntries(changedMods.map((id) => [id, draft.modules[id]])) } : {}),
      });
      toast({ title: 'Acesso salvo', description: `${changes} ${changes === 1 ? 'alteração' : 'alterações'} para ${person.name}.` });
    } catch (e) {
      toast({ title: 'Não foi possível salvar', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack} aria-label="Voltar para a lista">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PersonAvatar person={person} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-headline text-lg font-semibold">{person.name}</div>
          <div className="truncate text-sm text-muted-foreground">{[person.position, person.unitId ? unitPathLabel(units, person.unitId) : null].filter(Boolean).join(' · ')}</div>
        </div>
        <Select value="" onValueChange={copyFrom}>
          <SelectTrigger className="h-9 w-full gap-2 sm:w-56" aria-label="Copiar acesso de outra pessoa">
            <Copy className="h-4 w-4 shrink-0" />
            <SelectValue placeholder="Copiar acesso de…" />
          </SelectTrigger>
          <SelectContent>
            {people
              .filter((c) => c.id !== person.id)
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {PERMISSION_GROUPS.map((g) => {
        const locked = g.id === 'sistema' && !isSuperAdmin;
        return (
          <section key={g.id} className="grid gap-2 rounded-xl border bg-card p-4">
            <div>
              <h3 className="inline-flex items-center gap-2 font-semibold">
                {g.id === 'sistema' && <Lock className="h-4 w-4 text-muted-foreground" />}
                {GROUP_TITLE[g.id].title}
              </h3>
              <p className="text-sm text-muted-foreground">{GROUP_TITLE[g.id].hint}</p>
            </div>
            <div className="grid gap-x-6 sm:grid-cols-2">
              {g.items.map((it) => (
                <label key={it.key} className={cn('flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0', locked && 'opacity-60')}>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{it.label}</span>
                    {it.hint && <span className="block text-xs text-muted-foreground">{it.hint}</span>}
                  </span>
                  <Switch
                    checked={draft.permissions[it.key]}
                    disabled={locked}
                    onCheckedChange={(v) => setDraft((d) => ({ ...d, permissions: { ...d.permissions, [it.key]: v } }))}
                  />
                </label>
              ))}
            </div>
          </section>
        );
      })}

      <section className="grid gap-2 rounded-xl border bg-card p-4">
        <div>
          <h3 className="font-semibold">Módulos</h3>
          <p className="text-sm text-muted-foreground">Sistemas que abrem dentro do Connect. Com acesso, escolha o que a pessoa pode fazer em cada um.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {modules.map((m) => (
            <ModuleCard key={m.id} mod={m} value={draft.modules[m.id] ?? null} onChange={(v) => setDraft((d) => ({ ...d, modules: { ...d.modules, [m.id]: v } }))} />
          ))}
        </div>
      </section>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur">
        <span className="mr-auto text-sm text-muted-foreground">{changes ? `${changes} ${changes === 1 ? 'alteração' : 'alterações'} não salvas` : 'Nada alterado'}</span>
        <Button variant="outline" onClick={() => setDraft(original)} disabled={!changes || saving}>
          Descartar
        </Button>
        <Button onClick={() => void save()} disabled={!changes || saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar acesso
        </Button>
      </div>
    </div>
  );
}

/* ───────────── Tela ───────────── */

/** Acessos pessoa a pessoa: escolha alguém na lista e ligue ou desligue o que ela acessa. RH e super admin. */
export function AccessManager() {
  const { collaborators, loading } = useCollaborators();
  const { units, byId } = useOrgUnits();
  const [query, setQuery] = useState('');
  const [unitFilter, setUnitFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const people = useMemo(() => collaborators.filter((c) => c?.name && c.email).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [collaborators]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter(
      (c) => (!q || `${c.name} ${c.email} ${c.position ?? ''}`.toLowerCase().includes(q)) && (unitFilter === ALL || c.unitId === unitFilter),
    );
  }, [people, query, unitFilter]);
  const selected = people.find((c) => c.id === selectedId) ?? null;
  const sortedUnits = useMemo(() => [...units].sort((a, b) => unitPathLabel(byId, a.id).localeCompare(unitPathLabel(byId, b.id), 'pt-BR')), [units, byId]);

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="font-headline text-xl font-semibold">Acessos</h2>
        <p className="text-sm text-muted-foreground">Escolha uma pessoa e ligue ou desligue o que ela acessa. Para começar de um colega com a mesma função, use &quot;Copiar acesso de…&quot;.</p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={cn('grid gap-2 rounded-xl border bg-card p-3 lg:sticky lg:top-4', selected && 'hidden lg:grid')}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pessoa ou cargo" className="pl-9" aria-label="Buscar pessoa" />
          </div>
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger aria-label="Filtrar por equipe">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as equipes</SelectItem>
              {sortedUnits.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {unitPathLabel(byId, u.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground">{list.length} pessoas</div>
          <ul className="-mx-1 grid max-h-[65dvh] gap-0.5 overflow-y-auto px-1">
            {loading && <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />}
            {list.map((c) => {
              const admin = c.permissions?.canManageSystem || c.permissions?.canViewAudit;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    aria-current={selectedId === c.id}
                    className={cn('flex w-full items-center gap-2.5 rounded-lg p-2 text-left hover:bg-muted', selectedId === c.id && 'bg-primary/10 hover:bg-primary/10')}
                  >
                    <PersonAvatar person={c} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {c.name}
                        {c.hubHidden && <span className="rounded bg-muted px-1 text-[10px] font-semibold uppercase text-muted-foreground">oculto</span>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{(c.unitId && byId.get(c.unitId)?.name) || c.position || c.email}</span>
                    </span>
                    {admin && <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Acesso ao sistema" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
        {selected ? (
          <PersonEditor key={selected.id} person={selected} people={people} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="hidden min-h-[240px] place-items-center rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground lg:grid">
            Escolha uma pessoa na lista para ver e mudar o acesso dela.
          </div>
        )}
      </div>
    </div>
  );
}
