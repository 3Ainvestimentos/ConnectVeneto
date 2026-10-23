"use client";

/**
 * Botão "Erros e sugestões" do menu, no mesmo padrão dos módulos (Dados Estratégicos,
 * `BotaoErrosESugestoes`): a pessoa reporta um erro ou manda uma sugestão (aba Enviar) e acompanha
 * o que já mandou, com status e resposta da equipe (aba Minhas solicitações). A tela aberta vai
 * junto. Super admin vê todas e responde ali mesmo.
 *
 * Selo: acende quando alguma solicitação mudou de status desde a última vez que a pessoa abriu a
 * lista neste navegador (localStorage, só conveniência; sem storage o selo apenas não aparece).
 */
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2, MessageSquareWarning } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import {
  changedSince,
  currentStatuses,
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_STATUS,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_TYPE_LABEL,
  isOpenStatus,
  type FeedbackItem,
  type FeedbackListResponse,
  type FeedbackStatus,
  type FeedbackType,
  type SeenStatus,
} from '@/lib/feedback';
import { cn } from '@/lib/utils';

const SEEN_KEY = 'connect:feedback-vistos';

/** undefined = nunca abriu; null = sem storage (sem selo). */
function readSeen(): SeenStatus | null | undefined {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw === null ? undefined : (JSON.parse(raw) as SeenStatus);
  } catch {
    return null;
  }
}
function writeSeen(v: SeenStatus) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(v));
  } catch {
    // conveniência — ignorar
  }
}

const STATUS_TONE: Record<FeedbackStatus, string> = {
  aberto: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  em_analise: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  resolvido: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  descartado: 'bg-muted text-muted-foreground',
};
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

function useFeedbackApi() {
  const { user } = useAuth();
  return useCallback(
    async (method: 'GET' | 'POST' | 'PATCH', body?: unknown) => {
      const token = await user?.getIdToken();
      const res = await fetch('/api/feedback', {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: 'no-store',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'Não foi possível concluir.');
      return payload;
    },
    [user],
  );
}

function SendForm({ onSent }: { onSent: () => void }) {
  const api = useFeedbackApi();
  const pathname = usePathname();
  const [type, setType] = useState<FeedbackType>('erro');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || sending) return;
    setSending(true);
    try {
      await api('POST', { type, description: description.trim(), page: pathname });
      setDescription('');
      toast({ title: type === 'erro' ? 'Erro reportado' : 'Sugestão enviada', description: 'Acompanhe a resposta em Minhas solicitações.' });
      onSent();
    } catch (err) {
      toast({ title: 'Não foi possível enviar', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={(e) => void send(e)} className="grid gap-3">
      <div className="flex gap-2" role="radiogroup" aria-label="Tipo">
        {(['erro', 'sugestao'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => setType(t)}
            className={cn('rounded-full border px-3 py-1.5 text-sm font-medium', type === t ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
          >
            {t === 'erro' ? 'Reportar erro' : 'Enviar sugestão'}
          </button>
        ))}
      </div>
      <div className="grid gap-1">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={FEEDBACK_MAX_LENGTH}
          rows={6}
          autoFocus
          placeholder={type === 'erro' ? 'O que aconteceu? Conte o que você fez e o que esperava ver.' : 'O que poderia ser melhor no Connect?'}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Enviaremos junto a tela em que você está.</span>
          <span className="tabular-nums">
            {description.length}/{FEEDBACK_MAX_LENGTH}
          </span>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={!description.trim() || sending}>
          {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enviar
        </Button>
      </div>
    </form>
  );
}

/** Triagem (super admin): status e resposta. */
function TriageControls({ item, onSaved }: { item: FeedbackItem; onSaved: () => void }) {
  const api = useFeedbackApi();
  const [status, setStatus] = useState<FeedbackStatus>(item.status);
  const [response, setResponse] = useState(item.response ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = status !== item.status || response.trim() !== (item.response ?? '');
  const save = async () => {
    setSaving(true);
    try {
      await api('PATCH', { id: item.id, status, response: response.trim() || null });
      toast({ title: 'Solicitação atualizada' });
      onSaved();
    } catch (err) {
      toast({ title: 'Não foi possível salvar', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="grid gap-2 rounded-md border border-dashed p-2">
      <div className="flex flex-wrap gap-1.5">
        {FEEDBACK_STATUS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium', status === s ? STATUS_TONE[s] : 'text-muted-foreground hover:bg-muted')}
          >
            {FEEDBACK_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <Textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={2} placeholder="Resposta para quem enviou (o que foi feito)" maxLength={FEEDBACK_MAX_LENGTH} />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
          {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />} Salvar
        </Button>
      </div>
    </div>
  );
}

function RequestList({ items, all, changed, onSaved }: { items: FeedbackItem[]; all: boolean; changed: string[]; onSaved: () => void }) {
  const open = items.filter((i) => isOpenStatus(i.status)).length;
  const done = items.filter((i) => i.status === 'resolvido').length;
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {open} em andamento · {done} concluída{done === 1 ? '' : 's'}
      </p>
      <ol className="grid gap-2">
        {items.map((i) => (
          <li key={i.id} className={cn('grid gap-1.5 rounded-lg border p-3', changed.includes(i.id) && 'border-primary/50 bg-primary/5')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                <strong>{FEEDBACK_TYPE_LABEL[i.type]}</strong>
                {i.page && <span className="text-muted-foreground"> · {i.page}</span>}
              </span>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_TONE[i.status])}>{FEEDBACK_STATUS_LABEL[i.status]}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{i.description}</p>
            {i.response && (
              <div className="rounded-md bg-muted/60 p-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Resposta da equipe</div>
                <p className="whitespace-pre-wrap text-sm">{i.response}</p>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              enviada{all && i.authorName ? ` por ${i.authorName}` : ''} em {fmtDate(i.createdAt)}
              {i.updatedAt && ` · atualizada em ${fmtDate(i.updatedAt)}`}
              {changed.includes(i.id) && <strong className="text-primary"> · status atualizado</strong>}
            </div>
            {all && <TriageControls key={`${i.id}-${i.status}-${i.response ?? ''}`} item={i} onSaved={onSaved} />}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Item do menu lateral + janela "Erros e sugestões". */
export function FeedbackButton({ onOpen }: { onOpen?: () => void }) {
  const api = useFeedbackApi();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'enviar' | 'minhas'>('enviar');
  const [data, setData] = useState<FeedbackListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [changed, setChanged] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData((await api('GET')) as FeedbackListResponse);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  // Selo: compara com o que a pessoa viu da última vez.
  useEffect(() => {
    if (!data) return;
    const seen = readSeen();
    if (seen === null) return;
    if (seen === undefined) {
      writeSeen(currentStatuses(data.items));
      return;
    }
    setChanged(changedSince(data.items, seen));
    const fresh = data.items.filter((i) => seen[i.id] === undefined);
    if (fresh.length) writeSeen({ ...seen, ...currentStatuses(fresh) });
  }, [data]);

  const openDialog = () => {
    onOpen?.();
    setTab(changed.length > 0 ? 'minhas' : 'enviar');
    setOpen(true);
    void load();
  };
  const close = (o: boolean) => {
    setOpen(o);
    if (!o) {
      if (data) writeSeen(currentStatuses(data.items));
      setChanged([]);
    }
  };

  const items = data?.items ?? [];
  const label = changed.length ? `Erros e sugestões (${changed.length} com atualização)` : 'Erros e sugestões';

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={{ children: label, className: 'font-body' }} onClick={openDialog} className="font-body" aria-label={label}>
          <MessageSquareWarning />
          <span>Erros e sugestões</span>
          {changed.length > 0 && <Badge className="ml-auto h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px]">{changed.length}</Badge>}
        </SidebarMenuButton>
      </SidebarMenuItem>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Erros e sugestões</DialogTitle>
            <DialogDescription>Reporte um erro ou mande uma sugestão — e acompanhe aqui a resposta.</DialogDescription>
          </DialogHeader>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'enviar' | 'minhas')}>
            <TabsList>
              <TabsTrigger value="enviar">Enviar</TabsTrigger>
              <TabsTrigger value="minhas">
                {data?.all ? 'Solicitações (todas)' : 'Minhas solicitações'}
                {items.length > 0 && <span className="ml-1 text-muted-foreground">({items.length})</span>}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="enviar">
              <SendForm
                onSent={() => {
                  void load();
                  setTab('minhas');
                }}
              />
            </TabsContent>
            <TabsContent value="minhas">
              {failed ? (
                <p className="text-sm text-muted-foreground">Não foi possível carregar suas solicitações agora. Tente de novo em instantes.</p>
              ) : loading && !data ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </p>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Você ainda não enviou nenhuma solicitação.{' '}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => setTab('enviar')}>
                    Enviar a primeira
                  </button>
                </p>
              ) : (
                <RequestList items={items} all={!!data?.all} changed={changed} onSaved={() => void load()} />
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
