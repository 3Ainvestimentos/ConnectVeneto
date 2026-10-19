"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, Lock, Newspaper, PenSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VenetoMarketingFooter } from '@/components/layout/VenetoMarketingFooter';
import { ChannelChips } from '@/components/hub-feed/ChannelChips';
import { FeedPost } from '@/components/hub-feed/FeedPost';
import { HubDigestModal } from '@/components/hub-feed/HubDigestModal';
import { HubBreadcrumb, HubPage } from '@/components/hub-feed/HubPage';
import { NewPostDialog } from '@/components/hub-feed/NewPostDialog';
import { HubApiError, useHubFeed, useHubFeedActions } from '@/hooks/useHubFeed';
import { toast } from '@/hooks/use-toast';
import { followedNews } from '@/lib/hub/home';
import { isHighlighted, rankFeed } from '@/lib/hub/ranking';

/**
 * Publicações: o feed completo (Notícias e Avisos) por canal. Na Home ficam só os Avisos; as
 * Notícias chegam pelo Resumo diário e ficam guardadas aqui.
 */
export default function PublicacoesPage() {
  const { data, isLoading, error } = useHubFeed();
  const { follow } = useHubFeedActions();
  const [channelFilter, setChannelFilter] = useState('all');
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);
  const focusPostId = useSearchParams().get('p');

  const channels = useMemo(() => data?.channels ?? [], [data]);
  const channelName = (id: string) => channels.find((c) => c.id === id)?.name ?? '';
  const followedIds = useMemo(() => channels.filter((c) => c.following).map((c) => c.id), [channels]);

  // "Todos": canais seguidos + Avisos valendo (de qualquer canal). Num canal: tudo dele.
  const feed = useMemo(() => {
    const ranked = rankFeed(data?.posts ?? []);
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

  return (
    <>
      <HubPage className="max-w-[1100px] md:mx-0">
        <HubBreadcrumb items={[{ label: 'Início', href: '/inicio' }, { label: 'Publicações' }]} />
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-headline text-3xl font-bold sm:text-4xl">Publicações</h1>
            <p className="mt-1 text-base text-muted-foreground">Notícias e avisos da Vêneto, por canal.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data && (
              <Button onClick={() => setDigestOpen(true)} size="lg" variant="outline" className="text-base">
                <Newspaper className="mr-2 h-5 w-5" /> Resumo
              </Button>
            )}
            {canPublish && (
              <Button onClick={() => setNewPostOpen(true)} size="lg" className="text-base shadow-sm">
                <PenSquare className="mr-2 h-5 w-5" /> Nova publicação
              </Button>
            )}
          </div>
        </header>

        {notInPilot ? (
          <div className="grid max-w-lg justify-items-center gap-3 rounded-xl border bg-card p-10 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <h2 className="font-headline text-xl font-semibold">A nova Home está em piloto</h2>
            <p className="text-muted-foreground">Ela ainda não foi liberada para você. Enquanto isso, o Painel Inicial continua igual.</p>
            <Button asChild variant="outline">
              <Link href="/dashboard">Ir para o Painel Inicial</Link>
            </Button>
          </div>
        ) : (
          <main className="flex max-w-[760px] min-w-0 flex-col gap-5">
            <div className="grid gap-2">
              <ChannelChips channels={channels} channelFilter={channelFilter} onChannelFilter={setChannelFilter} onFollow={onFollow} newCounts={newCounts} />
              {channelFilter === 'all' && (
                <p className="text-sm text-muted-foreground">Mostrando os canais que você segue e os avisos. Escolha um canal para ver tudo dele.</p>
              )}
            </div>
            {channelFilter !== 'all' && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-4 py-3 text-base">
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
      {canPublish && data && <NewPostDialog open={newPostOpen} onOpenChange={setNewPostOpen} channels={channels} viewer={data.viewer} />}
      {digestOpen && <HubDigestModal onDemand since={data?.digestSeenAt} onOpenChange={setDigestOpen} />}
      <VenetoMarketingFooter variant="flow" />
    </>
  );
}
