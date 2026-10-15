"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Archive, CalendarCheck, CalendarPlus, Link2, Loader2, MessageSquare, MoreHorizontal, Pin, PinOff, Send, SmilePlus, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { useHubComments, useHubFeedActions } from '@/hooks/useHubFeed';
import { cn } from '@/lib/utils';
import { googleCalendarUrl } from '@/lib/hub/media';
import { REACTION_EMOJIS, RSVP_ANSWERS, type FeedPost as FeedPostData, type RsvpAnswer } from '@/lib/hub/model';
import { isHighlighted } from '@/lib/hub/ranking';
import { ButtonRow, FileList, ImageGallery, VideoBlock } from './PostAttachments';
import { UserAvatar } from './UserAvatar';
import { shortDate, timeAgo } from './format';

const RSVP_LABEL: Record<RsvpAnswer, string> = { vou: 'Vou', talvez: 'Talvez', nao: 'Não vou' };

/** Destaca "@Nome Sobrenome" no texto. */
function withMentions(text: string) {
  return text.split(/(@\p{Lu}\p{L}+ \p{Lu}\p{L}+)/u).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="rounded bg-primary/10 px-1 font-semibold text-primary">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

const fail = (e: unknown) => toast({ title: 'Não deu certo', description: e instanceof Error ? e.message : 'Tente de novo.', variant: 'destructive' });

function EventBlock({ post, preview }: { post: FeedPostData; preview?: boolean }) {
  const { rsvp } = useHubFeedActions();
  const event = post.event!;
  const date = new Date(event.start);
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const endTime = event.end ? new Date(event.end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  const choose = (answer: RsvpAnswer) => {
    if (preview) return;
    rsvp.mutateAsync({ postId: post.id, answer: post.myRsvp === answer ? null : answer }).catch(fail);
  };
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-lg bg-muted/60 p-3">
      <div className="min-w-14 rounded-lg border bg-card px-3 py-1 text-center">
        <div className="font-headline text-xl font-bold leading-tight">{date.getDate()}</div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</div>
      </div>
      <div className="min-w-0 text-sm">
        <div className="font-medium">{event.place || 'Local a definir'}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-muted-foreground">
          <span className="tabular-nums">{endTime ? `${time} às ${endTime}` : time}</span>
          {event.audience === 'Clientes' && (
            <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-200">Para clientes</span>
          )}
          <span>
            <b className="tabular-nums text-foreground">{post.rsvpCounts.vou}</b> confirmados
          </span>
          {event.calendarEventId && (
            <span className="inline-flex items-center gap-1" title="Evento do Google Agenda da Vêneto">
              <CalendarCheck className="h-3.5 w-3.5" /> Agenda da Vêneto
            </span>
          )}
        </div>
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-2">
        {RSVP_ANSWERS.map((a) => (
          <Button key={a} variant={post.myRsvp === a ? 'default' : 'outline'} className="h-9 px-4 text-sm" onClick={() => choose(a)} aria-pressed={post.myRsvp === a}>
            {RSVP_LABEL[a]}
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

function PollBlock({ post, preview }: { post: FeedPostData; preview?: boolean }) {
  const { vote } = useHubFeedActions();
  const poll = post.poll!;
  const voted = post.myVote;
  const total = post.pollCounts.reduce((a, n) => a + n, 0);
  return (
    <div className="grid gap-2">
      {poll.options.map((label, i) => {
        const pct = total ? Math.round(((post.pollCounts[i] ?? 0) / total) * 100) : 0;
        return (
          <button
            key={`${label}-${i}`}
            type="button"
            disabled={voted !== null || preview}
            onClick={() => vote.mutateAsync({ postId: post.id, optionIndex: i }).catch(fail)}
            className={cn(
              'relative overflow-hidden rounded-md border px-4 py-2.5 text-left text-[15px] transition-colors',
              voted === null && 'hover:border-primary',
              voted === i && 'border-primary font-semibold',
            )}
          >
            {voted !== null && <span className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${pct}%` }} />}
            <span className="relative flex justify-between gap-2">
              <span>{label}</span>
              {voted !== null && <span className="tabular-nums">{pct}%</span>}
            </span>
          </button>
        );
      })}
      <span className="text-sm text-muted-foreground">
        {total} votos · {voted === null ? 'escolha uma opção' : 'voto registrado'} · encerra em {shortDate(poll.closesAt)}
      </span>
    </div>
  );
}

function Comments({ post, viewerEmail }: { post: FeedPostData; viewerEmail: string }) {
  const { data: comments = [], isLoading } = useHubComments(post.id, true);
  const { addComment, setRelevant } = useHubFeedActions();
  const [draft, setDraft] = useState('');
  const isAuthor = post.canManage;
  const firstName = post.authorName.split(' ')[0];
  const hiddenCount = comments.filter((c) => !c.relevant).length;

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    addComment
      .mutateAsync({ postId: post.id, text })
      .then(() => {
        setDraft('');
        if (!isAuthor) {
          toast({ title: 'Comentário enviado', description: `${firstName} recebe seu comentário. Ele fica visível para todos se for marcado como relevante.` });
        }
      })
      .catch(fail);
  };

  return (
    <div className="grid gap-3 border-t pt-4">
      {isAuthor && comments.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Marque com <Star className="inline h-3 w-3" /> os comentários que devem aparecer para todos.
          {hiddenCount > 0 && ` ${hiddenCount} ${hiddenCount === 1 ? 'comentário está visível' : 'comentários estão visíveis'} só para você.`}
        </p>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">Carregando comentários…</p>}
      {comments.map((c) => {
        const privateToMe = !c.relevant && c.authorEmail === viewerEmail && !isAuthor;
        return (
          <div key={c.id} className="flex gap-2.5 text-[15px]">
            <UserAvatar email={c.authorEmail} name={c.authorName} size="sm" className="mt-1" />
            <div className={cn('min-w-0 flex-1 rounded-xl bg-muted px-3.5 py-2', !c.relevant && 'bg-muted/50')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="mr-1.5 font-semibold">{c.authorName}</span>
                  <span className="text-sm text-muted-foreground">{timeAgo(c.createdAt)}</span>
                </div>
                {isAuthor && (
                  <button
                    type="button"
                    onClick={() => setRelevant.mutateAsync({ postId: post.id, commentId: c.id, relevant: !c.relevant }).catch(fail)}
                    aria-pressed={c.relevant}
                    title={c.relevant ? 'Visível para todos. Clique para ocultar.' : 'Marcar como relevante'}
                    className={cn('inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm', c.relevant ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
                  >
                    <Star className={cn('h-3.5 w-3.5', c.relevant && 'fill-current')} />
                    {c.relevant ? 'Relevante' : 'Marcar'}
                  </button>
                )}
              </div>
              <p className="whitespace-pre-line break-words">{withMentions(c.text)}</p>
              {privateToMe && <p className="mt-1 text-sm text-muted-foreground">Só você e o autor veem este comentário.</p>}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !addComment.isPending && submit()}
          placeholder={isAuthor ? 'Responder…' : `Comentar para ${firstName}…`}
          className="h-10 rounded-full px-4 text-[15px]"
          aria-label="Escrever comentário"
          maxLength={2000}
        />
        <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" onClick={submit} disabled={addComment.isPending} aria-label="Enviar comentário">
          {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export function FeedPost({
  post,
  channelName,
  viewerEmail,
  preview = false,
}: {
  post: FeedPostData;
  channelName: string;
  viewerEmail: string;
  /** Pré-visualização no formulário: sem ações. */
  preview?: boolean;
}) {
  const { react, updatePost } = useHubFeedActions();
  const [showComments, setShowComments] = useState(false);
  const highlighted = isHighlighted(post);
  const reactions = Object.entries(post.reactionCounts).filter(([, n]) => n > 0);
  const commentLabel = post.canManage
    ? `${post.commentCount} ${post.commentCount === 1 ? 'comentário' : 'comentários'}`
    : post.relevantCommentCount
      ? `${post.relevantCommentCount} ${post.relevantCommentCount === 1 ? 'comentário' : 'comentários'}`
      : 'Comentar';

  const toggleReaction = (emoji: string) => {
    if (preview) return;
    react.mutateAsync({ postId: post.id, emoji: post.myReaction === emoji ? null : emoji }).catch(fail);
  };

  const copyLink = () => {
    const url = `${window.location.origin}/inicio?p=${post.id}`;
    navigator.clipboard?.writeText(url).then(
      () => toast({ title: 'Link copiado' }),
      () => toast({ title: 'Não foi possível copiar', description: url }),
    );
  };

  return (
    <article
      id={`post-${post.id}`}
      className={cn(
        'grid scroll-mt-24 gap-3 rounded-xl border bg-card p-4 shadow-sm sm:p-5',
        highlighted && 'border-l-4 border-l-primary border-primary/40 bg-gradient-to-br from-primary/[0.04] to-transparent',
      )}
    >
      <header className="flex items-start gap-3">
        <UserAvatar email={post.authorEmail} name={post.authorName} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px]">
            <span className="font-semibold">{post.authorName}</span>
            {post.authorPosition && <span className="hidden text-muted-foreground sm:inline"> · {post.authorPosition}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span>{timeAgo(post.createdAt)}</span>
            <span aria-hidden>·</span>
            <span>{channelName}</span>
            {highlighted && post.canManage && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1 text-primary">
                  <Pin className="h-3.5 w-3.5" /> em destaque até {shortDate(post.highlightUntil!)}
                </span>
              </>
            )}
          </div>
        </div>
        {!preview && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Mais opções">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={copyLink}>
                <Link2 className="mr-2 h-4 w-4" /> Copiar link
              </DropdownMenuItem>
              {post.event && (
                <DropdownMenuItem asChild>
                  <a href={googleCalendarUrl(post.title, post.event, post.body)} target="_blank" rel="noopener noreferrer">
                    <CalendarPlus className="mr-2 h-4 w-4" /> Adicionar ao Google Agenda
                  </a>
                </DropdownMenuItem>
              )}
              {post.canManage && (
                <>
                  <DropdownMenuSeparator />
                  {highlighted ? (
                    <DropdownMenuItem onSelect={() => updatePost.mutateAsync({ postId: post.id, patch: { highlightUntil: null } }).catch(fail)}>
                      <PinOff className="mr-2 h-4 w-4" /> Tirar do destaque
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() =>
                      updatePost
                        .mutateAsync({ postId: post.id, patch: { status: 'archived' } })
                        .then(() => toast({ title: 'Publicação arquivada', description: 'Ela saiu do feed.' }))
                        .catch(fail)
                    }
                  >
                    <Archive className="mr-2 h-4 w-4" /> Arquivar publicação
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <h3 className={cn('font-headline font-bold leading-snug', highlighted ? 'text-lg' : 'text-base')}>{post.title}</h3>
      {post.images.length > 0 && <ImageGallery images={post.images} />}
      <p className="whitespace-pre-line text-[15px] leading-relaxed">{withMentions(post.body)}</p>
      {post.video && <VideoBlock video={post.video} />}
      {post.files.length > 0 && <FileList files={post.files} />}
      {post.event && <EventBlock post={post} preview={preview} />}
      {post.poll && <PollBlock post={post} preview={preview} />}
      {post.buttons.length > 0 && <ButtonRow buttons={post.buttons} />}
      {post.source === 'news' && (
        <Link href="/news" className="text-[15px] font-medium text-primary hover:underline">
          Ler a notícia completa →
        </Link>
      )}

      <footer className="flex flex-wrap items-center gap-2 border-t pt-3">
        {reactions.map(([emoji, count]) => (
          <button
            key={emoji}
            type="button"
            onClick={() => toggleReaction(emoji)}
            aria-pressed={post.myReaction === emoji}
            title={post.myReaction === emoji ? 'Remover reação' : 'Reagir'}
            className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors', post.myReaction === emoji ? 'border-primary/60 bg-primary/10' : 'hover:bg-muted')}
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
              disabled={preview}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <SmilePlus className="h-4 w-4" />
              {reactions.length === 0 && <span>Reagir</span>}
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="flex w-auto gap-1 p-1.5">
            {REACTION_EMOJIS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => toggleReaction(emoji)} aria-pressed={post.myReaction === emoji} className={cn('rounded-md px-2 py-1 text-lg hover:bg-muted', post.myReaction === emoji && 'bg-primary/10')}>
                {emoji}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <button
          type="button"
          onClick={() => !preview && setShowComments((v) => !v)}
          className="ml-auto inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-expanded={showComments}
        >
          <MessageSquare className="h-4 w-4" />
          {commentLabel}
        </button>
      </footer>

      {showComments && <Comments post={post} viewerEmail={viewerEmail} />}
    </article>
  );
}
