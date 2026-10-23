"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BellRing, Loader2, Newspaper, PenSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChannelChips } from '@/components/hub-feed/ChannelChips';
import { FeedPost } from '@/components/hub-feed/FeedPost';
import { HubDigestModal } from '@/components/hub-feed/HubDigestModal';
import { HubPage } from '@/components/hub-feed/HubPage';
import { NewPostDialog } from '@/components/hub-feed/NewPostDialog';
import { HubApiError, useHubFeed, useHubFeedActions } from '@/hooks/useHubFeed';
import { toast } from '@/hooks/use-toast';
import { followedNews } from '@/lib/hub/home';
import { postKind, type PostKind } from '@/lib/hub/model';
import { isHighlighted, rankFeed } from '@/lib/hub/ranking';

/**
 * Publicações: Notícias e Avisos por canal. Aviso também vai para Avisos, na Home. Eventos não entram
 * aqui: ficam na Agenda e Eventos, onde são criados e excluídos.
 */
export default function PublicacoesPage() {
  const { data, isLoading, error } = useHubFeed();
  const { follow } = useHubFeedActions();
  const [channelFilter, setChannelFilter] = useState('all');
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [newKind, setNewKind] = useState<PostKind>('noticia');
  const startPost = (kind: PostKind) => {
    setNewKind(kind);
    setNewPostOpen(true);
  };
  const [digestOpen, setDigestOpen] = useState(false);
  const focusPostId = useSearchParams().get('p');
  const router = useRouter();

  const channels = useMemo(() => data?.channels ?? [], [data]);
  const channelName = (id: string) => channels.find((c) => c.id === id)?.name ?? '';
  const followedIds = useMemo(() => channels.filter((c) => c.following).map((c) => c.id), [channels]);

  // "Todos": canais seguidos + Avisos valendo (de qualquer canal). Num canal: tudo dele.
  const feed = useMemo(() => {
    const ranked = rankFeed((data?.posts ?? []).filter((p) => postKind(p) !== 'evento'));
    if (channelFilter !== 'all') return ranked.filter((p) => p.channelId === channelFilter);
    const followed = new Set(followedIds);
    return ranked.filter((p) => isHighlighted(p) || followed.has(p.channelId));
  }, [data, followedIds, channelFilter]);

  // Notícias que chegaram depois do último Resumo diário, por canal.
  const newCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const seen = data?.digestSeenAt;
    if (!data || !seen) return counts;
    for (const p of followedNews(data.posts, followedIds, data.viewer.email)) {
      if (p.createdAt > seen) counts[p.channelId] = (counts[p.channelId] ?? 0) + 1;
    }
    return counts;
  }, [data, followedIds]);

  // Link direto (/publicacoes?p=<id>): notificações, Resumo, Avisos e "Copiar link". Se a
  // publicação não está em "Todos" (canal não seguido), abre o canal dela antes de rolar.
  const focusHandled = useRef<string | null>(null);
  useEffect(() => {
    if (!focusPostId || !data || focusHandled.current === focusPostId) return;
    const target = data.posts.find((p) => p.id === focusPostId);
    if (target && !feed.some((p) => p.id === focusPostId)) {
      setChannelFilter(target.channelId);
      return;
    }
    focusHandled.current = focusPostId;
    // Espera o Resumo/notificações fecharem: o Dialog restaura o scroll ao sair e cortaria a rolagem.
    // Sem cleanup de propósito: um refetch do feed não pode cancelar a rolagem já decidida.
    setTimeout(() => document.getElementById(`post-${focusPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
  }, [focusPostId, data, feed]);

  const onFollow = (channelId: string, following: boolean) =>
    follow.mutateAsync({ channelId, following }).catch(() => toast({ title: 'Não foi possível atualizar o canal', variant: 'destructive' }));

  const canPublish = channels.some((c) => c.canPublish);
  const notInPilot = error instanceof HubApiError && error.status === 403;
  // Sem acesso à nova Home (revogado): vai direto para o Painel Inicial, sem aviso.
  useEffect(() => {
    if (notInPilot) router.replace('/dashboard');
  }, [notInPilot, router]);

  return (
    <>
      <HubPage className="max-w-3xl">
        <header className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="font-headline text-2xl font-bold sm:text-3xl">Publicações</h1>
              <p className="text-sm text-muted-foreground sm:text-base">Notícias e avisos da Vêneto, por canal.</p>
            </div>
            {data && (
              <Button onClick={() => setDigestOpen(true)} variant="outline">
                <Newspaper className="mr-2 h-4 w-4" /> Resumo
              </Button>
            )}
          </div>
          {canPublish && (
            <div className="grid grid-cols-2 gap-2 sm:max-w-md" role="group" aria-label="Publicar">
              <Button onClick={() => startPost('noticia')} className="shadow-sm">
                <PenSquare className="mr-2 h-4 w-4 shrink-0" /> <span className="truncate">Notícia</span>
              </Button>
              <Button onClick={() => startPost('aviso')} variant="outline">
                <BellRing className="mr-2 h-4 w-4 shrink-0" /> <span className="truncate">Aviso</span>
              </Button>
            </div>
          )}
        </header>

        {notInPilot ? null : (
          <main className="flex min-w-0 flex-col gap-5">
            <div className="grid gap-2">
              <ChannelChips channels={channels} channelFilter={channelFilter} onChannelFilter={setChannelFilter} onFollow={onFollow} newCounts={newCounts} />
              {channelFilter === 'all' && (
                <p className="text-sm text-muted-foreground">Mostrando os canais que você segue e os avisos. Escolha um canal para ver tudo dele.</p>
              )}
            </div>
            {channelFilter !== 'all' && (
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-muted/60 px-4 py-3 text-base">
                <span>
                  Mostrando só <b>{channelName(channelFilter)}</b>
                </span>
                <span className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      void onFollow(channelFilter, false);
                      setChannelFilter('all');
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    deixar de seguir
                  </button>
                  <button type="button" onClick={() => setChannelFilter('all')} className="font-medium text-primary hover:underline">
                    voltar a Todos
                  </button>
                </span>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Carregando as publicações…
              </div>
            )}
            {error && !notInPilot && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm">Não foi possível carregar as publicações. {error.message}</div>
            )}
            {data && feed.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                {channelFilter === 'all' ? 'Nada publicado nos canais que você segue.' : 'Nada publicado neste canal ainda.'}
              </div>
            )}
            {data && feed.map((post) => <FeedPost key={post.id} post={post} channelName={channelName(post.channelId)} viewerEmail={data.viewer.email} />)}
          </main>
        )}
      </HubPage>
      {canPublish && data && <NewPostDialog key={newKind} open={newPostOpen} onOpenChange={setNewPostOpen} channels={channels} viewer={data.viewer} kind={newKind} />}
      {digestOpen && <HubDigestModal onDemand since={data?.digestSeenAt} onOpenChange={setDigestOpen} />}
    </>
  );
}
