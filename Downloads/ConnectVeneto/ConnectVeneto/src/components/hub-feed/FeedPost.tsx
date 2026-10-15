"use client";

import { useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, CalendarPlus, Link2, MessageSquare, MoreHorizontal, Paperclip, Pin, Send, SmilePlus, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useHubMock } from '@/lib/hub-mock/store';
import { isHighlighted } from '@/lib/hub-mock/ranking';
import { REACTIONS } from '@/lib/hub-mock/data';
import { googleCalendarUrl } from '@/lib/hub-mock/media';
import type { Post } from '@/lib/hub-mock/types';
import { PersonAvatar } from './PersonAvatar';
import { ButtonRow, FileList, ImageGallery, VideoBlock } from './PostAttachments';
import { shortDate, timeAgo } from './format';

/** Destaca "@Nome Sobrenome" no texto. */
function withMentions(text: string) {
  const parts = text.split(/(@\p{Lu}\p{L}+ \p{Lu}\p{L}+)/u);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="rounded bg-primary/10 px-1 font-semibold text-primary">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function EventBlock({ post }: { post: Post }) {
  const { rsvp, setRsvp } = useHubMock();
  const event = post.event!;
  const mine = rsvp[post.id];
  const date = new Date(event.date);
  const options = [
    { value: 'vou', label: 'Vou' },
    { value: 'talvez', label: 'Talvez' },
    { value: 'nao', label: 'Não vou' },
  ] as const;
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const endTime = event.end ? new Date(event.end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-lg bg-muted/60 p-3">
      <div className="min-w-14 rounded-lg border bg-card px-3 py-1 text-center">
        <div className="font-headline text-xl font-bold leading-tight">{date.getDate()}</div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
        </div>
      </div>
      <div className="min-w-0 text-sm">
        <div className="font-medium">{event.place}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-muted-foreground">
          <span className="tabular-nums">{endTime ? `${time} às ${endTime}` : time}</span>
          {event.audience === 'Clientes' && (
            <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-200">
              Para clientes
            </span>
          )}
          <span>
            <b className="tabular-nums text-foreground">{event.going + (mine === 'vou' ? 1 : 0)}</b> confirmados
          </span>
          {event.material && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              {event.material}
            </span>
          )}
          {event.calendarEventId && (
            <span className="inline-flex items-center gap-1" title="Evento do Google Agenda da Vêneto">
              <CalendarCheck className="h-3.5 w-3.5" /> Agenda da Vêneto
            </span>
          )}
        </div>
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-2">
        {options.map((o) => (
          <Button
            key={o.value}
            variant={mine === o.value ? 'default' : 'outline'}
            className="h-9 px-4 text-sm"
            onClick={() => setRsvp(post.id, o.value)}
            aria-pressed={mine === o.value}
          >
            {o.label}
          </Button>
        ))}
        <a
          href={googleCalendarUrl(post.title, event, post.body)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary hover:underline"
        >
          <CalendarPlus className="h-4 w-4" /> Adicionar ao Google Agenda
        </a>
      </div>
    </div>
  );
}

function PollBlock({ post }: { post: Post }) {
  const { votes, vote } = useHubMock();
  const poll = post.poll!;
  const voted = votes[post.id];
  const total = poll.options.reduce((a, o) => a + o.votes, 0);
  return (
    <div className="grid gap-2">
      {poll.options.map((o, i) => {
        const pct = total ? Math.round((o.votes / total) * 100) : 0;
        return (
          <button
            key={o.label}
            type="button"
            disabled={voted !== undefined}
            onClick={() => vote(post.id, i)}
            className={cn(
              'relative overflow-hidden rounded-md border px-4 py-2.5 text-left text-[15px] transition-colors',
              voted === undefined && 'hover:border-primary',
              voted === i && 'border-primary font-semibold',
            )}
          >
            {voted !== undefined && <span className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${pct}%` }} />}
            <span className="relative flex justify-between gap-2">
              <span>{o.label}</span>
              {voted !== undefined && <span className="tabular-nums">{pct}%</span>}
            </span>
          </button>
        );
      })}
      <span className="text-sm text-muted-foreground">
        {total} votos · {voted === undefined ? 'escolha uma opção' : 'voto registrado'} · encerra em {shortDate(poll.closesAt)}
      </span>
    </div>
  );
}

function Comments({ post }: { post: Post }) {
  const { meId, personById, addComment, toggleRelevant } = useHubMock();
  const [draft, setDraft] = useState('');
  const isAuthor = post.authorId === meId;
  const author = personById(post.authorId);

  // Leitores veem só os relevantes (e os próprios, marcados como privados). O autor vê todos.
  const visible = isAuthor
    ? post.comments
    : post.comments.filter((c) => c.relevant || c.authorId === meId);
  const hiddenCount = post.comments.length - post.comments.filter((c) => c.relevant).length;

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    addComment(post.id, text);
    setDraft('');
    if (!isAuthor) {
      toast({
        title: 'Comentário enviado',
        description: `${author.name.split(' ')[0]} recebe seu comentário. Ele fica visível para todos se for marcado como relevante.`,
      });
    }
  };

  return (
    <div className="grid gap-3 border-t pt-4">
      {isAuthor && post.comments.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Você é o autor: marque com <Star className="inline h-3 w-3" /> os comentários que devem aparecer para todos.
          {hiddenCount > 0 && ` ${hiddenCount} ${hiddenCount === 1 ? 'comentário está visível' : 'comentários estão visíveis'} só para você.`}
        </p>
      )}
      {visible.map((c) => {
        const p = personById(c.authorId);
        const privateToMe = !c.relevant && c.authorId === meId && !isAuthor;
        return (
          <div key={c.id} className="flex gap-2.5 text-[15px]">
            <PersonAvatar person={p} size="sm" link className="mt-1" />
            <div className={cn('min-w-0 flex-1 rounded-xl bg-muted px-3.5 py-2', !c.relevant && 'bg-muted/50')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="mr-1.5 font-semibold">{p.name}</span>
                  <span className="text-sm text-muted-foreground">{timeAgo(c.createdAt)}</span>
                </div>
                {isAuthor && (
                  <button
                    type="button"
                    onClick={() => toggleRelevant(post.id, c.id)}
                    aria-pressed={c.relevant}
                    title={c.relevant ? 'Visível para todos. Clique para ocultar.' : 'Marcar como relevante'}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm',
                      c.relevant ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Star className={cn('h-3.5 w-3.5', c.relevant && 'fill-current')} />
                    {c.relevant ? 'Relevante' : 'Marcar'}
                  </button>
                )}
              </div>
              <p className="break-words">{withMentions(c.text)}</p>
              {privateToMe && <p className="mt-1 text-sm text-muted-foreground">Só você e o autor veem este comentário.</p>}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={isAuthor ? 'Responder…' : `Comentar para ${author.name.split(' ')[0]}…`}
          className="h-10 rounded-full px-4 text-[15px]"
          aria-label="Escrever comentário"
        />
        <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" onClick={submit} aria-label="Enviar comentário">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function FeedPost({ post }: { post: Post }) {
  const { personById, channelById, myReactions, react, role, meId } = useHubMock();
  const [showComments, setShowComments] = useState(false);
  const author = personById(post.authorId);
  const channel = channelById(post.channelId);
  const highlighted = isHighlighted(post);
  const relevantCount = post.comments.filter((c) => c.relevant).length;
  const mine = myReactions[post.id];
  const reactions = Object.entries(post.reactions).filter(([, n]) => n > 0);
  // Capa das Notícias migradas entra como a primeira imagem da galeria.
  const images = [...(post.coverUrl ? [{ url: post.coverUrl }] : []), ...(post.images ?? [])];

  return (
    <article
      className={cn(
        'grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:p-5',
        highlighted && 'border-l-4 border-l-primary border-primary/40 bg-gradient-to-br from-primary/[0.04] to-transparent',
      )}
    >
      <header className="flex items-start gap-3">
        <PersonAvatar person={author} link />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px]">
            <Link href={`/pessoas/${author.id}`} className="font-semibold hover:underline">
              {author.name}
            </Link>
            <span className="hidden text-muted-foreground sm:inline"> · {author.position}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span>{timeAgo(post.createdAt)}</span>
            <span aria-hidden>·</span>
            <span>{channel.name}</span>
            {post.source === 'news' && (
              <>
                <span aria-hidden>·</span>
                <span title="Publicada pelo RH em Notícias (dado real)">Notícias</span>
              </>
            )}
            {highlighted && role === 'publicador' && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1 text-primary">
                  <Pin className="h-3.5 w-3.5" /> em destaque até {shortDate(post.highlightUntil!)}
                </span>
              </>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Mais opções">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => toast({ title: 'Link copiado' })}>
              <Link2 className="mr-2 h-4 w-4" /> Copiar link
            </DropdownMenuItem>
            {post.event && (
              <DropdownMenuItem asChild>
                <a href={googleCalendarUrl(post.title, post.event, post.body)} target="_blank" rel="noopener noreferrer">
                  <CalendarPlus className="mr-2 h-4 w-4" /> Adicionar ao Google Agenda
                </a>
              </DropdownMenuItem>
            )}
            {post.authorId === meId && (
              <DropdownMenuItem onSelect={() => toast({ title: 'Edição não está no wireframe' })}>Editar publicação</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <h3 className={cn('font-headline font-bold leading-snug', highlighted ? 'text-lg' : 'text-base')}>{post.title}</h3>

      {images.length > 0 ? (
        <ImageGallery images={images} />
      ) : (
        post.cover && (
          <div className="flex h-24 items-end rounded-lg bg-gradient-to-br from-slate-800 via-slate-700 to-primary p-4 font-headline text-sm font-semibold text-white sm:h-32">
            {post.cover}
          </div>
        )
      )}

      <p className="whitespace-pre-line text-[15px] leading-relaxed">{withMentions(post.body)}</p>

      {post.video && <VideoBlock video={post.video} />}
      {post.files && post.files.length > 0 && <FileList files={post.files} />}
      {post.event && <EventBlock post={post} />}
      {post.poll && <PollBlock post={post} />}
      {post.buttons && post.buttons.length > 0 && <ButtonRow buttons={post.buttons} />}
      {post.link && (
        <Link href={post.link.href} className="text-[15px] font-medium text-primary hover:underline">
          {post.link.label} →
        </Link>
      )}

      <footer className="flex flex-wrap items-center gap-2 border-t pt-3">
        {reactions.map(([emoji, count]) => (
          <button
            key={emoji}
            type="button"
            onClick={() => react(post.id, emoji)}
            aria-pressed={mine === emoji}
            title={mine === emoji ? 'Remover reação' : 'Reagir'}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
              mine === emoji ? 'border-primary/60 bg-primary/10' : 'hover:bg-muted',
            )}
          >
            {emoji}
            <span className="tabular-nums">{count}</span>
          </button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Adicionar reação"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <SmilePlus className="h-4 w-4" />
              {reactions.length === 0 && <span>Reagir</span>}
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="flex w-auto gap-1 p-1.5">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => react(post.id, emoji)}
                aria-pressed={mine === emoji}
                className={cn('rounded-md px-2 py-1 text-lg hover:bg-muted', mine === emoji && 'bg-primary/10')}
              >
                {emoji}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="ml-auto inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-expanded={showComments}
        >
          <MessageSquare className="h-4 w-4" />
          {post.authorId === meId
            ? `${post.comments.length} comentários`
            : relevantCount
              ? `${relevantCount} ${relevantCount === 1 ? 'comentário' : 'comentários'}`
              : 'Comentar'}
        </button>
      </footer>

      {showComments && <Comments post={post} />}
    </article>
  );
}
