"use client";

import React, { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { ArrowDown, ArrowUp, Database, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import SuperAdminGuard from '@/components/auth/SuperAdminGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { getFirebaseApp } from '@/lib/firebase';
import { useHubModules } from '@/hooks/useHubModules';
import { MODULE_ICON_NAMES, getModuleIcon } from '@/components/layout/module-icons';
import { ALLOWED_MODULE_HOST_SUFFIXES, type HubModule } from '@/config/modules';

const API = '/api/admin/modules';

async function adminRequest<T = Record<string, unknown>>(
  url: string,
  init: { method: string; body?: unknown },
): Promise<T> {
  const currentUser = getAuth(getFirebaseApp()).currentUser;
  if (!currentUser) throw new Error('Sessão expirada. Entre novamente para continuar.');
  const token = await currentUser.getIdToken();
  const response = await fetch(url, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const payload = (await response.json().catch(() => null)) as ({ error?: string } & T) | null;
  if (!response.ok) throw new Error(payload?.error ?? 'Não foi possível concluir a operação.');
  return (payload ?? {}) as T;
}

const notifyError = (error: unknown) =>
  toast({
    title: 'Erro',
    description: error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.',
    variant: 'destructive',
  });

/* ------------------------------------------------------------------------ */
/* Formulário                                                               */
/* ------------------------------------------------------------------------ */

type FormState = {
  id: string;
  label: string;
  description: string;
  iconName: string;
  enabled: boolean;
  showInNav: boolean;
  noZoom: boolean;
  slug: string;
  url: string;
  embedPath: string;
  accessMode: 'all' | 'explicit';
  layout: 'fullscreen' | 'framed';
  skeletonTheme: 'default' | 'light';
  defaultPermissions: string;
  adminPermissions: string;
  permissionCatalog: string;
};

const EMPTY_FORM: FormState = {
  id: '',
  label: '',
  description: '',
  iconName: 'Puzzle',
  enabled: false,
  showInNav: true,
  noZoom: true,
  slug: '',
  url: 'https://',
  embedPath: '/embed',
  accessMode: 'explicit',
  layout: 'fullscreen',
  skeletonTheme: 'default',
  defaultPermissions: '',
  adminPermissions: '',
  permissionCatalog: '',
};

const splitList = (value: string) =>
  value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

/** Uma sub-permissão por linha: `chave | Rótulo`. */
const parseCatalog = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, ...rest] = line.split('|');
      const label = rest.join('|').trim();
      return { key: key.trim(), label: label || key.trim() };
    });

function toForm(mod: HubModule): FormState {
  const base = {
    ...EMPTY_FORM,
    id: mod.id,
    label: mod.label,
    description: mod.description ?? '',
    iconName: mod.iconName,
    enabled: mod.enabled,
    showInNav: mod.showInNav,
    noZoom: mod.noZoom,
  };
  if (mod.kind !== 'embedded') return base;
  return {
    ...base,
    slug: mod.slug,
    url: mod.url,
    embedPath: mod.embedPath,
    accessMode: mod.accessMode,
    layout: mod.layout,
    skeletonTheme: mod.skeletonTheme === 'light' ? 'light' : 'default',
    defaultPermissions: mod.defaultPermissions.join('\n'),
    adminPermissions: mod.adminPermissions.join('\n'),
    permissionCatalog: mod.permissionCatalog.map((p) => `${p.key} | ${p.label}`).join('\n'),
  };
}

function toPayload(form: FormState, kind: HubModule['kind'], isNew: boolean) {
  const common = {
    label: form.label.trim(),
    description: form.description.trim(),
    iconName: form.iconName,
    enabled: form.enabled,
    showInNav: form.showInNav,
    noZoom: form.noZoom,
  };
  if (kind === 'internal') return common;
  return {
    ...(isNew ? { id: form.id.trim(), kind: 'embedded' as const } : {}),
    ...common,
    slug: form.slug.trim(),
    url: form.url.trim().replace(/\/+$/, ''),
    embedPath: form.embedPath.trim() || '/embed',
    accessMode: form.accessMode,
    layout: form.layout,
    skeletonTheme: form.skeletonTheme === 'light' ? ('light' as const) : ('dark' as const),
    defaultPermissions: splitList(form.defaultPermissions),
    adminPermissions: splitList(form.adminPermissions),
    permissionCatalog: parseCatalog(form.permissionCatalog),
  };
}

type EditorState = { mode: 'create' } | { mode: 'edit'; module: HubModule } | null;

function ModuleEditor({ state, onClose }: { state: EditorState; onClose: () => void }) {
  const isNew = state?.mode === 'create';
  const kind: HubModule['kind'] = state?.mode === 'edit' ? state.module.kind : 'embedded';
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  // Reinicia o formulário ao abrir para outro módulo.
  const key = state ? (state.mode === 'edit' ? `edit:${state.module.id}` : 'create') : null;
  if (key !== lastKey) {
    setLastKey(key);
    setForm(state?.mode === 'edit' ? toForm(state.module) : EMPTY_FORM);
  }

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = toPayload(form, kind, isNew);
      if (isNew) {
        await adminRequest(API, { method: 'POST', body });
      } else if (state?.mode === 'edit') {
        await adminRequest(`${API}?id=${encodeURIComponent(state.module.id)}`, { method: 'PATCH', body });
      }
      toast({ title: isNew ? 'Módulo criado' : 'Módulo atualizado', description: form.label });
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  const Icon = getModuleIcon(form.iconName);

  return (
    <Dialog open={state !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Novo módulo embarcado' : `Editar ${state?.mode === 'edit' ? state.module.label : ''}`}</DialogTitle>
          <DialogDescription>
            {kind === 'internal'
              ? 'Página interna do ConnectVeneto: dá para mudar nome, ícone e visibilidade. O endereço e a permissão ficam no código.'
              : 'Módulo aberto em iframe com login automático (hub-auth). O módulo precisa aceitar este hub em NEXT_PUBLIC_HUB_ORIGIN e usar o mesmo HUB_JWT_SECRET.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {isNew && (
            <Field label="Id do módulo" hint="Vai no token (aud) e nas permissões, ex.: meu-modulo. Não muda depois.">
              <Input value={form.id} onChange={(e) => set('id', e.target.value.toLowerCase())} placeholder="meu-modulo" />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome no menu">
              <Input value={form.label} onChange={(e) => set('label', e.target.value)} />
            </Field>
            <Field label="Ícone">
              <Select value={form.iconName} onValueChange={(v) => set('iconName', v)}>
                <SelectTrigger>
                  <span className="flex items-center gap-2"><Icon className="h-4 w-4" /><SelectValue /></span>
                </SelectTrigger>
                <SelectContent>
                  {MODULE_ICON_NAMES.map((name) => {
                    const ItemIcon = getModuleIcon(name);
                    return (
                      <SelectItem key={name} value={name}>
                        <span className="flex items-center gap-2"><ItemIcon className="h-4 w-4" />{name}</span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Descrição" hint={kind === 'embedded' ? 'Aparece como subtítulo no layout com cabeçalho.' : undefined}>
            <Input value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>

          {kind === 'embedded' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Endereço no hub" hint={`Fica em /${form.slug || 'slug'}`}>
                  <Input value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} placeholder="meu-modulo" />
                </Field>
                <Field label="Rota de embed no módulo">
                  <Input value={form.embedPath} onChange={(e) => set('embedPath', e.target.value)} />
                </Field>
              </div>

              <Field label="URL do módulo (origem)" hint={`Só protocolo e domínio, sem barra final. Domínios aceitos: ${ALLOWED_MODULE_HOST_SUFFIXES.join(', ')}.`}>
                <Input value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://meu-modulo.azurewebsites.net" />
              </Field>

              <div className="grid grid-cols-3 gap-4">
                <Field label="Quem acessa">
                  <Select value={form.accessMode} onValueChange={(v) => set('accessMode', v as FormState['accessMode'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="explicit">Só quem for liberado</SelectItem>
                      <SelectItem value="all">Todos por padrão</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Layout">
                  <Select value={form.layout} onValueChange={(v) => set('layout', v as FormState['layout'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fullscreen">Tela cheia</SelectItem>
                      <SelectItem value="framed">Com cabeçalho</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Skeleton">
                  <Select value={form.skeletonTheme} onValueChange={(v) => set('skeletonTheme', v as FormState['skeletonTheme'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Padrão</SelectItem>
                      <SelectItem value="light">Claro</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Permissões padrão"
                  hint="Uma por linha. Vão no token de quem não tem registro próprio (só em 'Todos por padrão')."
                >
                  <Textarea rows={3} value={form.defaultPermissions} onChange={(e) => set('defaultPermissions', e.target.value)} placeholder={`${form.id || 'id'}:view`} />
                </Field>
                <Field label="Permissões de super admin" hint="Uma por linha.">
                  <Textarea rows={3} value={form.adminPermissions} onChange={(e) => set('adminPermissions', e.target.value)} placeholder={`${form.id || 'id'}:view\n${form.id || 'id'}:manage`} />
                </Field>
              </div>

              <Field
                label="Sub-permissões da tela de acessos"
                hint={`Uma por linha no formato "chave | Rótulo". A chave ${form.id || 'id'}:manage libera a tela /${form.slug || 'slug'}/admin.`}
              >
                <Textarea rows={4} value={form.permissionCatalog} onChange={(e) => set('permissionCatalog', e.target.value)} placeholder={`${form.id || 'id'}:manage | Admin Módulo`} />
              </Field>
            </>
          )}

          <div className="flex flex-wrap gap-6">
            <Toggle label="Ativo" checked={form.enabled} onChange={(v) => set('enabled', v)} />
            <Toggle label="Mostrar no menu" checked={form.showInNav} onChange={(v) => set('showInNav', v)} />
            <Toggle label="Sem zoom de conteúdo" checked={form.noZoom} onChange={(v) => set('noZoom', v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}

/* ------------------------------------------------------------------------ */
/* Lista                                                                    */
/* ------------------------------------------------------------------------ */

function ModulesTable() {
  const { modules, loading, isFallback } = useHubModules();
  const [busy, setBusy] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [toDelete, setToDelete] = useState<HubModule | null>(null);

  const run = async (key: string, action: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    try {
      await action();
      if (success) toast({ title: success });
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(null);
    }
  };

  const handleSeed = () =>
    run('seed', () => adminRequest(`${API}?action=seed`, { method: 'POST' }), 'Registro padrão gravado no banco.');

  const handleMove = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= modules.length) return;
    const ids = modules.map((m) => m.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(`move:${modules[index].id}`, () => adminRequest(API, { method: 'PUT', body: { ids } }));
  };

  const handleToggleEnabled = (mod: HubModule, enabled: boolean) =>
    run(`enabled:${mod.id}`, () =>
      adminRequest(`${API}?id=${encodeURIComponent(mod.id)}`, { method: 'PATCH', body: { enabled } }),
    );

  const handleDelete = async () => {
    if (!toDelete) return;
    const mod = toDelete;
    setToDelete(null);
    await run(`delete:${mod.id}`, () =>
      adminRequest(`${API}?id=${encodeURIComponent(mod.id)}`, { method: 'DELETE' }), `${mod.label} excluído.`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>Módulos e menu</CardTitle>
            <CardDescription>
              Itens do menu lateral na ordem em que aparecem. Módulos embarcados novos entram aqui sem deploy;
              o acesso de cada colaborador é dado na aba Permissões.
            </CardDescription>
          </div>
          <Button onClick={() => setEditor({ mode: 'create' })} disabled={isFallback}>
            <Plus className="mr-2 h-4 w-4" /> Novo módulo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isFallback && !loading && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p>
              O registro ainda não está no banco: o menu usa a lista embutida no código.
              Grave o registro padrão para poder editar, reordenar e cadastrar módulos.
            </p>
            <Button variant="outline" onClick={handleSeed} disabled={busy === 'seed'}>
              {busy === 'seed' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              Gravar registro padrão
            </Button>
          </div>
        )}

        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Ordem</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((mod, index) => {
                const Icon = getModuleIcon(mod.iconName);
                const disabled = isFallback || busy !== null;
                return (
                  <TableRow key={mod.id} className={mod.enabled ? '' : 'opacity-60'}>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={disabled || index === 0} onClick={() => handleMove(index, -1)} aria-label="Subir">
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={disabled || index === modules.length - 1} onClick={() => handleMove(index, 1)} aria-label="Descer">
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        <Icon className="h-4 w-4" /> {mod.label}
                        {!mod.showInNav && <Badge variant="outline">fora do menu</Badge>}
                      </div>
                      <span className="text-xs text-muted-foreground">{mod.id}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={mod.kind === 'embedded' ? 'default' : 'secondary'}>
                        {mod.kind === 'embedded' ? 'Embarcado' : 'Interno'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{mod.href}</div>
                      {mod.kind === 'embedded' && <div className="text-xs text-muted-foreground break-all">{mod.url}</div>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {mod.kind === 'embedded'
                        ? (mod.accessMode === 'all' ? 'Todos' : 'Liberação na aba Permissões')
                        : (mod.permission ?? 'Todos')}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={mod.enabled}
                        disabled={disabled}
                        onCheckedChange={(v) => handleToggleEnabled(mod, v)}
                        aria-label={`Ativar ou desativar ${mod.label}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={disabled} onClick={() => setEditor({ mode: 'edit', module: mod })} aria-label={`Editar ${mod.label}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {mod.kind === 'embedded' && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" disabled={disabled} onClick={() => setToDelete(mod)} aria-label={`Excluir ${mod.label}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <ModuleEditor state={editor} onClose={() => setEditor(null)} />

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => { if (!open) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {toDelete?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              O item sai do menu e o endereço {toDelete?.href} passa a dar 404. As permissões já dadas aos
              colaboradores ficam guardadas e voltam a valer se um módulo com o mesmo id for cadastrado.
              Para só esconder, desative o módulo em vez de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function ManageModules() {
  return (
    <SuperAdminGuard>
      <ModulesTable />
    </SuperAdminGuard>
  );
}
