"use client";

import { useRef, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  CalendarSearch,
  FileText,
  ImagePlus,
  Link2,
  Loader2,
  MousePointerClick,
  Plus,
  Trash2,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { daysFromNow } from '@/lib/hub-mock/data';
import { formatBytes, parseVideoUrl } from '@/lib/hub-mock/media';
import { useHubMock } from '@/lib/hub-mock/store';
import type { Importance, Post, PostButton, PostFile, PostImage, PostVideo } from '@/lib/hub-mock/types';
import { FeedPost } from './FeedPost';
import { shortDate, toDateInput } from './format';

interface EventDraft {
  date: string;
  start: string;
  end: string;
  place: string;
  audience: 'Interno' | 'Clientes';
  calendarEventId?: string;
  addToCompanyCalendar: boolean;
}

interface CalendarItem {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

const toTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
const atLocal = (date: string, time: string) => new Date(`${date}T${time || '09:00'}:00`).toISOString();

function Block({ icon: Icon, title, onRemove, children }: { icon: LucideIcon; title: string; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </span>
        <button type="button" onClick={onRemove} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remover ${title.toLowerCase()}`}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 p-3">{children}</div>
    </div>
  );
}

function AddButton({ icon: Icon, label, onClick, disabled }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 rounded-lg border bg-card px-2 py-2.5 text-xs font-medium transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

/** Importa um evento do Google Agenda da Vêneto (mesmo calendário do widget da Home atual, via /api/calendar). */
function CalendarImport({ onPick }: { onPick: (item: CalendarItem) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CalendarItem[] | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    if (items || loading) return;
    setLoading(true);
    setError('');
    try {
      const token = await user?.getIdToken();
      const timeMin = new Date().toISOString();
      const timeMax = daysFromNow(120);
      const res = await fetch(`/api/calendar?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'Falha ao ler a agenda.');
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao ler a agenda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void load();
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="justify-self-start">
          <CalendarSearch className="mr-2 h-4 w-4" /> Importar do Google Agenda da Vêneto
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-80 w-80 overflow-y-auto p-1">
        {loading && (
          <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lendo a agenda…
          </p>
        )}
        {error && (
          <div className="grid gap-1 p-3 text-sm">
            <p className="text-destructive">Não foi possível ler o Google Agenda da Vêneto agora.</p>
            <p className="text-xs text-muted-foreground">Preencha o evento manualmente. Detalhe: {error}</p>
          </div>
        )}
        {items?.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhum evento nos próximos 4 meses.</p>}
        {items?.map((it) => {
          const start = it.start.dateTime ?? it.start.date ?? '';
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => {
                onPick(it);
                setOpen(false);
              }}
              className="grid w-full gap-0.5 rounded-md px-3 py-2 text-left hover:bg-muted"
            >
              <span className="truncate text-sm font-medium">{it.summary}</span>
              <span className="text-xs text-muted-foreground">
                {start && shortDate(start)}
                {it.start.dateTime && ` · ${toTime(it.start.dateTime)}`}
                {it.location && ` · ${it.location}`}
              </span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

export function NewPostDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { publishableChannels, addPost, meId } = useHubMock();
  const [channelId, setChannelId] = useState(publishableChannels[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [importance, setImportance] = useState<Importance>('normal');
  const [highlightUntil, setHighlightUntil] = useState(toDateInput(daysFromNow(7)));
  const [images, setImages] = useState<PostImage[]>([]);
  const [video, setVideo] = useState<PostVideo | null>(null);
  const [videoMode, setVideoMode] = useState<'upload' | 'link' | null>(null);
  const [videoLink, setVideoLink] = useState('');
  const [files, setFiles] = useState<PostFile[]>([]);
  const [buttons, setButtons] = useState<PostButton[] | null>(null);
  const [event, setEvent] = useState<EventDraft | null>(null);
  const [poll, setPoll] = useState<string[] | null>(null);
  const [mobileTab, setMobileTab] = useState<'editar' | 'previa'>('editar');
  const [submitted, setSubmitted] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle('');
    setBody('');
    setImportance('normal');
    setImages([]);
    setVideo(null);
    setVideoMode(null);
    setVideoLink('');
    setFiles([]);
    setButtons(null);
    setEvent(null);
    setPoll(null);
    setSubmitted(false);
    setMobileTab('editar');
  };

  // Wireframe: arquivos ficam em URLs locais (blob:). Na versão real sobem para o Storage (pasta publicacoes/).
  const pickImages = (list: FileList | null) => {
    if (!list) return;
    setImages((prev) => [...prev, ...Array.from(list).map((f) => ({ url: URL.createObjectURL(f), name: f.name }))]);
  };
  const pickFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list).map((f) => ({ url: URL.createObjectURL(f), name: f.name, size: f.size }))]);
  };
  const pickVideo = (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    setVideo({ kind: 'upload', url: URL.createObjectURL(f), name: f.name });
  };

  const validButtons = (buttons ?? []).filter((b) => b.label.trim() && /^https?:\/\//i.test(b.href.trim()));
  const pollOptions = (poll ?? []).map((o) => o.trim()).filter(Boolean);

  const draft: Post = {
    id: 'preview',
    channelId: channelId || publishableChannels[0]?.id || 'institucional',
    authorId: meId,
    title: title.trim() || 'Título da publicação',
    body: body.trim() || 'O texto da publicação aparece aqui.',
    createdAt: new Date().toISOString(),
    importance,
    highlightUntil: importance === 'importante' ? atLocal(highlightUntil, '23:59') : undefined,
    expiresAt: event ? atLocal(event.date, '23:59') : undefined,
    images: images.length ? images : undefined,
    video: video ?? undefined,
    files: files.length ? files : undefined,
    buttons: validButtons.length ? validButtons.map((b) => ({ label: b.label.trim(), href: b.href.trim() })) : undefined,
    event: event
      ? {
          date: atLocal(event.date, event.start),
          end: event.end ? atLocal(event.date, event.end) : undefined,
          place: event.place || 'Local a definir',
          audience: event.audience,
          going: 0,
          calendarEventId: event.calendarEventId,
        }
      : undefined,
    poll: pollOptions.length >= 2 ? { options: pollOptions.map((label) => ({ label, votes: 0 })), closesAt: daysFromNow(7) } : undefined,
    reactions: {},
    comments: [],
  };

  const missing = !title.trim() || !body.trim() || !channelId;

  const publish = () => {
    setSubmitted(true);
    if (missing) {
      setMobileTab('editar');
      return;
    }
    const { id: _id, authorId: _a, createdAt: _c, reactions: _r, comments: _cm, ...input } = draft;
    addPost(input);
    toast({
      title: 'Publicado',
      description:
        event?.addToCompanyCalendar && !event.calendarEventId
          ? 'Na versão real, o evento também entra no Google Agenda da Vêneto.'
          : importance === 'importante'
            ? `Fica no topo do feed até ${shortDate(draft.highlightUntil!)}.`
            : 'A publicação já aparece no feed.',
    });
    reset();
    onOpenChange(false);
  };

  const fromCalendar = (it: CalendarItem) => {
    const start = it.start.dateTime ?? (it.start.date ? `${it.start.date}T09:00:00` : new Date().toISOString());
    const end = it.end?.dateTime;
    setEvent((e) => ({
      ...(e ?? { audience: 'Interno' as const, addToCompanyCalendar: false }),
      date: toDateInput(new Date(start).toISOString()),
      start: it.start.dateTime ? toTime(it.start.dateTime) : '09:00',
      end: end ? toTime(end) : '',
      place: it.location ?? e?.place ?? '',
      calendarEventId: it.id,
      addToCompanyCalendar: false,
    }));
    if (!title.trim()) setTitle(it.summary);
    if (!body.trim() && it.description) setBody(it.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  };

  const form = (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="np-channel">Canal</Label>
          <Select value={channelId} onValueChange={setChannelId}>
            <SelectTrigger id="np-channel">
              <SelectValue placeholder="Escolha o canal" />
            </SelectTrigger>
            <SelectContent>
              {publishableChannels.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Importância</Label>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md bg-muted p-1 text-sm" role="radiogroup" aria-label="Importância">
              {(['normal', 'importante'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={importance === v}
                  onClick={() => setImportance(v)}
                  className={cn('rounded px-3 py-1.5 font-medium', importance === v ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                >
                  {v === 'normal' ? 'Normal' : 'Importante'}
                </button>
              ))}
            </div>
            {importance === 'importante' && (
              <Input aria-label="Em destaque até" type="date" value={highlightUntil} onChange={(e) => setHighlightUntil(e.target.value)} className="h-9 w-auto" title="Fica no topo do feed até esta data" />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="np-title">Título</Label>
        <Input id="np-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Vêneto Day 2026: confirme sua presença" />
        {submitted && !title.trim() && <p className="text-xs text-destructive">Escreva um título.</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="np-body">Texto</Label>
        <Textarea id="np-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Use @Nome Sobrenome para mencionar alguém." />
        {submitted && !body.trim() && <p className="text-xs text-destructive">Escreva o texto da publicação.</p>}
      </div>

      {images.length > 0 && (
        <Block icon={ImagePlus} title={`Imagens (${images.length})`} onRemove={() => setImages([])}>
          <div className="grid grid-cols-4 gap-2">
            {images.map((img, i) => (
              <div key={img.url} className="group relative aspect-square overflow-hidden rounded-md bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.name ?? ''} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  aria-label="Remover imagem"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => imageInput.current?.click()} className="grid aspect-square place-items-center rounded-md border border-dashed text-muted-foreground hover:border-primary hover:text-primary" aria-label="Adicionar mais imagens">
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </Block>
      )}

      {videoMode && (
        <Block
          icon={Video}
          title="Vídeo"
          onRemove={() => {
            setVideo(null);
            setVideoMode(null);
            setVideoLink('');
          }}
        >
          <div className="inline-flex rounded-md bg-muted p-1 text-sm">
            {(['upload', 'link'] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setVideoMode(m); setVideo(null); }} className={cn('rounded px-3 py-1', videoMode === m ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
                {m === 'upload' ? 'Enviar arquivo' : 'Link do YouTube ou Drive'}
              </button>
            ))}
          </div>
          {videoMode === 'upload' ? (
            video ? (
              <p className="truncate text-sm">{video.name}</p>
            ) : (
              <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => videoInput.current?.click()}>
                Escolher vídeo (até 300 MB)
              </Button>
            )
          ) : (
            <Input
              aria-label="Link do vídeo"
              value={videoLink}
              onChange={(e) => {
                setVideoLink(e.target.value);
                setVideo(parseVideoUrl(e.target.value));
              }}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          )}
        </Block>
      )}

      {files.length > 0 && (
        <Block icon={FileText} title={`Arquivos (${files.length})`} onRemove={() => setFiles([])}>
          <ul className="grid gap-1.5">
            {files.map((f, i) => (
              <li key={f.url} className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} aria-label="Remover arquivo" className="text-muted-foreground hover:text-foreground">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => fileInput.current?.click()}>
            <Plus className="mr-1 h-4 w-4" /> Mais arquivos
          </Button>
        </Block>
      )}

      {buttons && (
        <Block icon={MousePointerClick} title="Botões com link" onRemove={() => setButtons(null)}>
          {buttons.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
              <Input aria-label="Texto do botão" value={b.label} onChange={(e) => setButtons((prev) => prev!.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Inscreva-se" />
              <Input aria-label="Endereço do link" value={b.href} onChange={(e) => setButtons((prev) => prev!.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))} placeholder="https://…" />
              <Button type="button" variant="ghost" size="icon" onClick={() => setButtons((prev) => (prev!.length > 1 ? prev!.filter((_, j) => j !== i) : null))} aria-label="Remover botão">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {buttons.length < 3 && (
            <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setButtons((prev) => [...prev!, { label: '', href: '' }])}>
              <Plus className="mr-1 h-4 w-4" /> Outro botão
            </Button>
          )}
        </Block>
      )}

      {event && (
        <Block icon={CalendarDays} title="Evento" onRemove={() => setEvent(null)}>
          <CalendarImport onPick={fromCalendar} />
          {event.calendarEventId && <p className="text-xs text-muted-foreground">Vinculado a um evento do Google Agenda da Vêneto.</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="np-ev-date">Data</Label>
              <Input id="np-ev-date" type="date" value={event.date} onChange={(e) => setEvent({ ...event, date: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np-ev-start">Início</Label>
              <Input id="np-ev-start" type="time" value={event.start} onChange={(e) => setEvent({ ...event, start: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np-ev-end">Fim</Label>
              <Input id="np-ev-end" type="time" value={event.end} onChange={(e) => setEvent({ ...event, end: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr]">
            <div className="grid gap-1.5">
              <Label htmlFor="np-ev-place">Local</Label>
              <Input id="np-ev-place" value={event.place} onChange={(e) => setEvent({ ...event, place: e.target.value })} placeholder="Unidade BH ou link da reunião" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np-ev-aud">Público</Label>
              <Select value={event.audience} onValueChange={(v) => setEvent({ ...event, audience: v as EventDraft['audience'] })}>
                <SelectTrigger id="np-ev-aud">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Interno">Interno</SelectItem>
                  <SelectItem value="Clientes">Para clientes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {!event.calendarEventId && (
            <label className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm">
              <span>
                <span className="block font-medium">Criar também no Google Agenda da Vêneto</span>
                <span className="text-xs text-muted-foreground">Aparece no calendário da empresa. Cada pessoa ainda pode adicionar à própria agenda.</span>
              </span>
              <Switch checked={event.addToCompanyCalendar} onCheckedChange={(v) => setEvent({ ...event, addToCompanyCalendar: v })} />
            </label>
          )}
        </Block>
      )}

      {poll && (
        <Block icon={BarChart3} title="Enquete" onRemove={() => setPoll(null)}>
          {poll.map((o, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label={`Opção ${i + 1}`} value={o} onChange={(e) => setPoll((prev) => prev!.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Opção ${i + 1}`} />
              {poll.length > 2 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setPoll((prev) => prev!.filter((_, j) => j !== i))} aria-label="Remover opção">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {poll.length < 6 && (
            <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setPoll((prev) => [...prev!, ''])}>
              <Plus className="mr-1 h-4 w-4" /> Outra opção
            </Button>
          )}
        </Block>
      )}

      <div className="grid gap-2">
        <span className="text-sm font-medium">Adicionar à publicação</span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <AddButton icon={ImagePlus} label="Imagens" onClick={() => imageInput.current?.click()} />
          <AddButton icon={Video} label="Vídeo" disabled={!!videoMode} onClick={() => setVideoMode('upload')} />
          <AddButton icon={FileText} label="Arquivo" onClick={() => fileInput.current?.click()} />
          <AddButton icon={Link2} label="Botão" disabled={!!buttons} onClick={() => setButtons([{ label: '', href: '' }])} />
          <AddButton
            icon={CalendarDays}
            label="Evento"
            disabled={!!event}
            onClick={() => setEvent({ date: toDateInput(daysFromNow(14)), start: '09:00', end: '', place: '', audience: 'Interno', addToCompanyCalendar: true })}
          />
          <AddButton icon={BarChart3} label="Enquete" disabled={!!poll} onClick={() => setPoll(['', ''])} />
        </div>
      </div>

      <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => { pickImages(e.target.files); e.target.value = ''; }} />
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => { pickFiles(e.target.files); e.target.value = ''; }} />
      <input ref={videoInput} type="file" accept="video/*" hidden onChange={(e) => { pickVideo(e.target.files); e.target.value = ''; }} />
    </div>
  );

  const preview = (
    <div className="grid content-start gap-2">
      <span className="text-sm font-medium text-muted-foreground">Pré-visualização</span>
      <div className="pointer-events-none select-none">
        <FeedPost post={draft} />
      </div>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Nova publicação</DialogTitle>
          <DialogDescription>Escreva, adicione o que precisar e confira a prévia antes de publicar.</DialogDescription>
          <div className="mt-2 inline-flex self-start rounded-md bg-muted p-1 text-sm lg:hidden">
            {(['editar', 'previa'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setMobileTab(t)} className={cn('rounded px-3 py-1', mobileTab === t ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
                {t === 'editar' ? 'Editar' : 'Pré-visualizar'}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_420px] lg:overflow-hidden">
          <div className={cn('min-w-0 p-6 lg:overflow-y-auto', mobileTab === 'previa' && 'hidden lg:block')}>{form}</div>
          <div className={cn('min-w-0 overflow-x-hidden border-l bg-muted/30 p-6 lg:overflow-y-auto', mobileTab === 'editar' && 'hidden lg:block')}>{preview}</div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={publish}>Publicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
