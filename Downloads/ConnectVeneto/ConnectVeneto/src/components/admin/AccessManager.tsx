"use client";

import { useMemo, useState } from 'react';
import { Check, Loader2, Lock, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators, type Collaborator } from '@/contexts/CollaboratorsContext';
import { hasPerPersonAccess, isEmbeddedModule, moduleViewKey, type HubModule } from '@/config/modules';
import { toast } from '@/hooks/use-toast';
import { useAccessActions, useAccessProfiles } from '@/hooks/useAccessProfiles';
import { useHubModules } from '@/hooks/useHubModules';
import { useOrgUnits } from '@/hooks/useOrgUnits';
import { PERMISSION_GROUPS, SYSTEM_PERMISSION_KEYS, type PermissionKey } from '@/lib/access/catalog';
import { countOverrides, effectiveAccess, resolveProfile, type AccessOverrides, type AccessProfile } from '@/lib/access/profiles';
import { childUnits, unitPathLabel, type OrgUnit } from '@/lib/hub/org-units';
import { cn } from '@/lib/utils';

/** Itens do menu sem acesso próprio (seguem o do piloto): não aparecem como módulo. */
const SHARED_ACCESS_MODULES = new Set(['pessoas', 'publicacoes']);
const INHERIT = '__herdar__';

/** Módulos com acesso por pessoa e as sub-permissões de cada um. */
function useAccessModules() {
  const { modules } = useHubModules();
  return useMemo(
    () =>
      modules
        .filter((m) => m.enabled && hasPerPersonAccess(m) && !SHARED_ACCESS_MODULES.has(m.id))
        .map((m: HubModule) => ({
          id: m.id,
          label: m.label,
          viewKey: moduleViewKey(m.id),
          catalog: isEmbeddedModule(m) ? m.permissionCatalog.filter((c) => c.key !== moduleViewKey(m.id)) : [],
          defaultAll: m.accessMode === 'all',
        })),
    [modules],
  );
}
type AccessModule = ReturnType<typeof useAccessModules>[number];

function useIsSystemSafe() {
  const { isSuperAdmin } = useAuth();
  return (keys: PermissionKey[]) => isSuperAdmin || !keys.some((k) => SYSTEM_PERMISSION_KEYS.includes(k));
}

/* ───────────── Editor de um módulo: sem registro / liberado (+ sub-permissões) / bloqueado ───────────── */

type ModuleState = 'default' | 'on' | 'off';
const moduleState = (list: string[] | null | undefined): ModuleState => (list == null ? 'default' : list.length === 0 ? 'off' : 'on');

function ModuleRow({
  mod,
  value,
  onChange,
  disabled,
  defaultLabel,
}: {
  mod: AccessModule;
  value: string[] | null | undefined;
  onChange: (next: string[] | null) => void;
  disabled?: boolean;
  defaultLabel: string;
}) {
  const state = moduleState(value);
  const list = value ?? [];
  return (
    <div className="grid gap-2 rounded-md border p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{mod.label}</span>
        <Select
          value={state}
          disabled={disabled}
          onValueChange={(v) => onChange(v === 'default' ? null : v === 'off' ? [] : [mod.viewKey, ...list.filter((k) => k !== mod.viewKey)])}
        >
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{defaultLabel}</SelectItem>
            <SelectItem value="on">Liberado</SelectItem>
            <SelectItem value="off">Bloqueado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {state === 'on' && mod.catalog.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pl-1">
          {mod.catalog.map((c) => (
            <label key={c.key} className="inline-flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={list.includes(c.key)}
                disabled={disabled}
                onCheckedChange={(v) => onChange(v ? [...list, c.key] : list.filter((k) => k !== c.key))}
              />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────── Perfis ───────────── */

function ProfileDialog({ profile, onClose }: { profile: AccessProfile | 'new' | null; onClose: () => void }) {
  const { isSuperAdmin } = useAuth();
  const modules = useAccessModules();
  const { createProfile, updateProfile } = useAccessActions();
  const editing = profile && profile !== 'new' ? profile : null;
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [perms, setPerms] = useState<Set<PermissionKey>>(new Set(editing?.permissions ?? []));
  const [mods, setMods] = useState<Record<string, string[]>>(editing?.modules ?? {});
  const [saving, setSaving] = useState(false);
  const readOnly = !isSuperAdmin;

  const save = async () => {
    setSaving(true);
    try {
      const body = { name: name.trim(), description: description.trim() || undefined, permissions: [...perms], modules: mods };
      if (editing) {
        const changed = await updateProfile(editing.id, body);
        toast({ title: 'Perfil salvo', description: changed ? `${changed} ${changed === 1 ? 'pessoa teve' : 'pessoas tiveram'} o acesso atualizado.` : 'Ninguém mudou de acesso.' });
      } else {
        await createProfile(body);
        toast({ title: 'Perfil criado', description: 'Atribua a uma equipe ou pessoa para valer.' });
      }
      onClose();
    } catch (e) {
      toast({ title: 'Não foi possível salvar', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!profile} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? (readOnly ? editing.name : `Editar perfil: ${editing.name}`) : 'Novo perfil de acesso'}</DialogTitle>
          <DialogDescription>{readOnly ? 'Só um super admin edita perfis.' : 'O que este perfil libera. Quem tem o perfil (pela equipe ou próprio) recebe isso, mais os ajustes da pessoa.'}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <div className="grid gap-1.5">
              <Label htmlFor="pf-name">Nome</Label>
              <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} placeholder="Ex.: Comercial" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-desc">Descrição</Label>
              <Textarea id="pf-desc" rows={1} value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly} placeholder="Para quem é este perfil" />
            </div>
          </div>
          {PERMISSION_GROUPS.map((g) => (
            <section key={g.id} className="grid gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.label}</h4>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {g.items.map((it) => (
                  <label key={it.key} className="flex items-start gap-2 rounded-md border p-2 text-sm" title={it.hint}>
                    <Checkbox
                      className="mt-0.5"
                      checked={perms.has(it.key)}
                      disabled={readOnly}
                      onCheckedChange={(v) =>
                        setPerms((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(it.key);
                          else next.delete(it.key);
                          return next;
                        })
                      }
                    />
                    <span>
                      {it.label}
                      {it.hint && <span className="block text-xs text-muted-foreground">{it.hint}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ))}
          <section className="grid gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Módulos</h4>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {modules.map((m) => (
                <ModuleRow
                  key={m.id}
                  mod={m}
                  value={mods[m.id]}
                  disabled={readOnly}
                  defaultLabel={m.defaultAll ? 'Padrão (liberado)' : 'Padrão (bloqueado)'}
                  onChange={(next) =>
                    setMods((prev) => {
                      const copy = { ...prev };
                      if (next === null) delete copy[m.id];
                      else copy[m.id] = next;
                      return copy;
                    })
                  }
                />
              ))}
            </div>
          </section>
        </div>
        {!readOnly && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar perfil
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProfilesTab({ usage }: { usage: Map<string, { units: number; people: number }> }) {
  const { isSuperAdmin } = useAuth();
  const { profiles, loading } = useAccessProfiles();
  const { deleteProfile } = useAccessActions();
  const [open, setOpen] = useState<AccessProfile | 'new' | null>(null);

  const remove = async (p: AccessProfile) => {
    if (!window.confirm(`Excluir o perfil "${p.name}"?`)) return;
    try {
      await deleteProfile(p.id);
      toast({ title: 'Perfil excluído' });
    } catch (e) {
      toast({ title: 'Não foi possível excluir', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Cada perfil é um pacote de acesso. Ele vale para a equipe que o recebe (e as de baixo) e para quem o tiver como próprio.</p>
        {isSuperAdmin && (
          <Button size="sm" onClick={() => setOpen('new')}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo perfil
          </Button>
        )}
      </div>
      {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {!loading && profiles.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum perfil criado ainda.</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {profiles.map((p) => {
          const u = usage.get(p.id) ?? { units: 0, people: 0 };
          const count = p.permissions.length + Object.values(p.modules).filter((l) => l.length > 0).length;
          return (
            <div key={p.id} className="grid content-start gap-2 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{p.name}</div>
                  {p.description && <div className="text-sm text-muted-foreground">{p.description}</div>}
                </div>
                {p.permissions.some((k) => SYSTEM_PERMISSION_KEYS.includes(k)) && (
                  <Badge variant="outline" className="shrink-0 gap-1">
                    <Lock className="h-3 w-3" /> Sistema
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {count} {count === 1 ? 'item liberado' : 'itens liberados'} · {u.units} {u.units === 1 ? 'equipe' : 'equipes'} · {u.people} {u.people === 1 ? 'pessoa' : 'pessoas'}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setOpen(p)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> {isSuperAdmin ? 'Editar' : 'Ver'}
                </Button>
                {isSuperAdmin && (
                  <Button size="sm" variant="ghost" onClick={() => void remove(p)} disabled={u.units + u.people > 0} title={u.units + u.people > 0 ? 'Em uso' : 'Excluir'}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {open && <ProfileDialog key={open === 'new' ? 'new' : open.id} profile={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ───────────── Equipes: perfil de cada unidade ───────────── */

function UnitsTab({ peopleByUnit }: { peopleByUnit: Map<string, number> }) {
  const { units, byId } = useOrgUnits();
  const { profiles } = useAccessProfiles();
  const { setUnitProfile } = useAccessActions();
  const safe = useIsSystemSafe();
  const [saving, setSaving] = useState<string | null>(null);
  const profileIds = useMemo(() => new Set(profiles.map((p) => p.id)), [profiles]);
  const name = (id: string | null | undefined) => profiles.find((p) => p.id === id)?.name;

  const change = async (u: OrgUnit, value: string) => {
    setSaving(u.id);
    try {
      await setUnitProfile(u.id, value === INHERIT ? null : value);
      toast({ title: 'Perfil da equipe salvo', description: 'O acesso de quem está nela foi recalculado.' });
    } catch (e) {
      toast({ title: 'Não foi possível salvar', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const Row = ({ unit, depth }: { unit: OrgUnit; depth: number }) => {
    const inherited = resolveProfile({ unitId: unit.parentId }, byId, profileIds);
    return (
      <>
        <div className="flex flex-wrap items-center gap-2 border-b py-2" style={{ paddingLeft: depth * 20 }}>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{unit.name}</span>
            <span className="text-xs text-muted-foreground">{peopleByUnit.get(unit.id) ?? 0} pessoas direto nela</span>
          </span>
          <Select value={unit.accessProfileId && profileIds.has(unit.accessProfileId) ? unit.accessProfileId : INHERIT} onValueChange={(v) => void change(unit, v)} disabled={saving === unit.id}>
            <SelectTrigger className="h-9 w-64 max-w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INHERIT}>{inherited.profileId ? `Herdar: ${name(inherited.profileId)}` : 'Sem perfil'}</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id} disabled={!safe(p.permissions)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saving === unit.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {childUnits(units, unit.id).map((c) => (
          <Row key={c.id} unit={c} depth={depth + 1} />
        ))}
      </>
    );
  };

  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">O perfil da unidade vale para quem está nela e nas unidades de baixo que não tiverem perfil próprio. Pessoas podem ter perfil próprio e ajustes na aba Pessoas.</p>
      <div className="rounded-xl border bg-card px-3">
        {childUnits(units, null).map((u) => (
          <Row key={u.id} unit={u} depth={0} />
        ))}
      </div>
    </div>
  );
}

/* ───────────── Pessoas: perfil efetivo, ajustes e edição ───────────── */

function PersonDialog({ person, onClose }: { person: Collaborator | null; onClose: () => void }) {
  const { isSuperAdmin } = useAuth();
  const { profiles } = useAccessProfiles();
  const { byId: units } = useOrgUnits();
  const modules = useAccessModules();
  const { setPersonAccess } = useAccessActions();
  const safe = useIsSystemSafe();
  const profileIds = useMemo(() => new Set(profiles.map((p) => p.id)), [profiles]);
  const [ownProfile, setOwnProfile] = useState<string>(person?.accessProfileId ?? INHERIT);
  const [overrides, setOverrides] = useState<AccessOverrides>(person?.accessOverrides ?? {});
  const [saving, setSaving] = useState(false);
  if (!person) return null;

  const fromUnit = resolveProfile({ unitId: person.unitId }, units, profileIds);
  const activeId = ownProfile !== INHERIT && profileIds.has(ownProfile) ? ownProfile : fromUnit.profileId;
  const profile = profiles.find((p) => p.id === activeId) ?? null;
  const base = profile ? effectiveAccess(profile) : null;
  const eff = profile ? effectiveAccess(profile, overrides) : null;

  const setPerm = (k: PermissionKey, v: 'perfil' | 'sim' | 'nao') =>
    setOverrides((prev) => {
      const permissions = { ...(prev.permissions ?? {}) };
      if (v === 'perfil') delete permissions[k];
      else permissions[k] = v === 'sim';
      return { ...prev, permissions };
    });
  const setModule = (id: string, next: string[] | null | 'perfil') =>
    setOverrides((prev) => {
      const mods = { ...(prev.modules ?? {}) };
      if (next === 'perfil') delete mods[id];
      else mods[id] = next;
      return { ...prev, modules: mods };
    });

  const save = async () => {
    setSaving(true);
    try {
      await setPersonAccess(person.id, { accessProfileId: ownProfile === INHERIT ? null : ownProfile, accessOverrides: overrides });
      toast({ title: 'Acesso salvo', description: profile ? undefined : 'Sem perfil, nada muda: escolha um perfil para a pessoa ou para a equipe dela.' });
      onClose();
    } catch (e) {
      toast({ title: 'Não foi possível salvar', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{person.name}</DialogTitle>
          <DialogDescription>{person.unitId ? unitPathLabel(units, person.unitId) : 'Sem unidade no organograma'}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Perfil</Label>
            <Select value={ownProfile} onValueChange={setOwnProfile}>
              <SelectTrigger className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={INHERIT}>{fromUnit.profileId ? `Da equipe: ${profiles.find((p) => p.id === fromUnit.profileId)?.name}` : 'Da equipe (nenhum)'}</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id} disabled={!safe(p.permissions)}>
                    Próprio: {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!profile && <p className="text-xs text-amber-700 dark:text-amber-400">Sem perfil, o acesso desta pessoa continua o de antes, marcado à mão.</p>}
          </div>

          {profile && base && eff && (
            <>
              {PERMISSION_GROUPS.map((g) => (
                <section key={g.id} className="grid gap-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.label}</h4>
                  {g.items.map((it) => {
                    const ov = overrides.permissions?.[it.key];
                    const locked = !isSuperAdmin && SYSTEM_PERMISSION_KEYS.includes(it.key);
                    return (
                      <div key={it.key} className={cn('flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5', ov !== undefined && 'bg-amber-50 dark:bg-amber-950/30')}>
                        <span className="text-sm">
                          {it.label}
                          <span className="ml-2 text-xs text-muted-foreground">perfil: {base.permissions[it.key] ? 'sim' : 'não'}</span>
                        </span>
                        <div className="inline-flex rounded-md bg-muted p-0.5 text-xs" role="radiogroup" aria-label={it.label}>
                          {(['perfil', 'sim', 'nao'] as const).map((v) => {
                            const active = (v === 'perfil' && ov === undefined) || (v === 'sim' && ov === true) || (v === 'nao' && ov === false);
                            return (
                              <button
                                key={v}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                disabled={locked}
                                onClick={() => setPerm(it.key, v)}
                                className={cn('rounded px-2.5 py-1 font-medium disabled:opacity-50', active ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                              >
                                {v === 'perfil' ? 'Do perfil' : v === 'sim' ? 'Sim' : 'Não'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </section>
              ))}
              <section className="grid gap-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Módulos</h4>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {modules.map((m) => {
                    const overridden = overrides.modules && m.id in overrides.modules;
                    return (
                      <div key={m.id} className={cn('grid gap-1 rounded-md', overridden && 'bg-amber-50 p-1 dark:bg-amber-950/30')}>
                        <ModuleRow
                          mod={m}
                          value={overridden ? overrides.modules![m.id] : base.modulePermissions[m.id]}
                          defaultLabel={m.defaultAll ? 'Padrão (liberado)' : 'Padrão (bloqueado)'}
                          onChange={(next) => setModule(m.id, next)}
                        />
                        {overridden && (
                          <button type="button" onClick={() => setModule(m.id, 'perfil')} className="justify-self-start px-1 text-xs text-primary hover:underline">
                            voltar ao do perfil
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
              <p className="text-xs text-muted-foreground">Em amarelo, o que é ajuste desta pessoa (diferente do perfil).</p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PeopleTab() {
  const { collaborators, loading } = useCollaborators();
  const { profiles } = useAccessProfiles();
  const { byId: units } = useOrgUnits();
  const [query, setQuery] = useState('');
  const [onlyNoProfile, setOnlyNoProfile] = useState(false);
  const [editing, setEditing] = useState<Collaborator | null>(null);
  const profileIds = useMemo(() => new Set(profiles.map((p) => p.id)), [profiles]);
  const profileName = (id: string | null) => profiles.find((p) => p.id === id)?.name;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return collaborators
      .filter((c) => c?.name && c.email)
      .map((c) => ({ c, source: resolveProfile({ accessProfileId: c.accessProfileId, unitId: c.unitId }, units, profileIds) }))
      .filter(({ c, source }) => (!q || `${c.name} ${c.email}`.toLowerCase().includes(q)) && (!onlyNoProfile || !source.profileId))
      .sort((a, b) => a.c.name.localeCompare(b.c.name, 'pt-BR'));
  }, [collaborators, units, profileIds, query, onlyNoProfile]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pessoa" className="pl-9" aria-label="Buscar pessoa" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <Checkbox checked={onlyNoProfile} onCheckedChange={(v) => setOnlyNoProfile(!!v)} /> Só quem está sem perfil
        </label>
        <span className="ml-auto text-sm text-muted-foreground">{rows.length} pessoas</span>
      </div>
      <div className="max-h-[70dvh] overflow-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted/90 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
            <tr>
              <th className="sticky left-0 bg-muted/90 px-3 py-2">Colaborador</th>
              <th className="px-3 py-2">Unidade</th>
              <th className="px-3 py-2">Perfil</th>
              <th className="px-3 py-2">Ajustes</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            )}
            {rows.map(({ c, source }) => {
              const n = countOverrides(c.accessOverrides);
              return (
                <tr key={c.id} className="border-t hover:bg-muted/40">
                  <td className="sticky left-0 bg-card px-3 py-2">
                    <div className="font-medium">
                      {c.name}
                      {c.hubHidden && <span className="ml-2 rounded bg-muted px-1.5 text-[10px] font-semibold uppercase text-muted-foreground">oculto</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground" title={c.unitId ? unitPathLabel(units, c.unitId) : ''}>
                    {c.unitId ? units.get(c.unitId)?.name ?? '—' : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {source.profileId ? (
                      <span>
                        {profileName(source.profileId)}
                        <span className="block text-xs text-muted-foreground">{source.from === 'pessoa' ? 'próprio' : `da equipe ${units.get(source.unitId!)?.name ?? ''}`}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-amber-700 dark:text-amber-400">sem perfil (acesso manual)</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{n > 0 ? <Badge variant="secondary">{n}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Acesso
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editing && <PersonDialog key={editing.id} person={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/* ───────────── Tela ───────────── */

/** Acessos (ADR 0005): perfis por equipe, perfil próprio e ajustes por pessoa. RH e super admin. */
export function AccessManager() {
  const { collaborators } = useCollaborators();
  const { units } = useOrgUnits();
  const { profiles } = useAccessProfiles();
  const [tab, setTab] = useState('equipes');

  const { usage, peopleByUnit } = useMemo(() => {
    const usage = new Map<string, { units: number; people: number }>();
    const bump = (id: string | null | undefined, k: 'units' | 'people') => {
      if (!id) return;
      const u = usage.get(id) ?? { units: 0, people: 0 };
      u[k] += 1;
      usage.set(id, u);
    };
    for (const u of units) bump(u.accessProfileId, 'units');
    for (const c of collaborators) bump(c.accessProfileId, 'people');
    const peopleByUnit = new Map<string, number>();
    for (const c of collaborators) if (c.unitId) peopleByUnit.set(c.unitId, (peopleByUnit.get(c.unitId) ?? 0) + 1);
    return { usage, peopleByUnit };
  }, [units, collaborators]);

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="font-headline text-xl font-semibold">Acessos</h2>
        <p className="text-sm text-muted-foreground">
          {profiles.length === 0 ? (
            <>
              <X className="mr-1 inline h-3.5 w-3.5" /> Nenhum perfil ainda: o acesso de todos continua o marcado à mão.
            </>
          ) : (
            <>
              <Check className="mr-1 inline h-3.5 w-3.5" /> O acesso vem do perfil da equipe (ou do perfil próprio), mais os ajustes de cada pessoa.
            </>
          )}
        </p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="equipes">Equipes</TabsTrigger>
          <TabsTrigger value="pessoas">Pessoas</TabsTrigger>
          <TabsTrigger value="perfis">Perfis</TabsTrigger>
        </TabsList>
        <TabsContent value="equipes">
          <UnitsTab peopleByUnit={peopleByUnit} />
        </TabsContent>
        <TabsContent value="pessoas">
          <PeopleTab />
        </TabsContent>
        <TabsContent value="perfis">
          <ProfilesTab usage={usage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
