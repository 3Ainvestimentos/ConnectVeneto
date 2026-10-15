"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, Lock, PenSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VenetoMarketingFooter } from '@/components/layout/VenetoMarketingFooter';
import { canAccessEmbeddedModule } from '@/components/layout/navigation';
import TrackFlowSummary from '@/components/dashboard-v2/TrackFlowSummary';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';
import { ChannelChips } from '@/components/hub-feed/ChannelChips';
import { FeedPost } from '@/components/hub-feed/FeedPost';
import { HubPage } from '@/components/hub-feed/HubPage';
import { IndicatorsCard } from '@/components/hub-feed/IndicatorsCard';
import { NewPostDialog } from '@/components/hub-feed/NewPostDialog';
import { PeoplePanel } from '@/components/hub-feed/PeoplePanel';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { isEmbeddedModule } from '@/config/modules';
import { HubApiError, useHubFeed, useHubFeedActions } from '@/hooks/useHubFeed';
import { useHubModules } from '@/hooks/useHubModules';
import { toast } from '@/hooks/use-toast';
import { findCollaboratorByEmail } from '@/lib/email-utils';
import { rankFeed } from '@/lib/hub/ranking';

/** Módulo "Dados Estratégicos" (id histórico: portal-repasse). */
const STRATEGIC_MODULE_ID = 'portal-repasse';

function useGreeting() {
  const [greeting, setGreeting] = useState('');
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite');
  }, []);
  return greeting;
}

export default function InicioPage() {
  const { user, permissions, isSuperAdmin } = useAuth();
  const { collaborators } = useCollaborators();
  const { modules } = useHubModules();
  const { data, isLoading, error } = useHubFeed();
  const { follow } = useHubFeedActions();
  const [channelFilter, setChannelFilter] = useState('all');
  const [newPostOpen, setNewPostOpen] = useState(false);
  const greeting = useGreeting();
  const focusPostId = useSearchParams().get('p');

  const collab = useMemo(() => (user ? findCollaboratorByEmail(collaborators, user.email) ?? null : null), [user, collaborators]);
  const firstName = collab?.name?.split(' ')[0] || user?.displayName?.split(' ')[0] || '';

  const canSeeStrategic = useMemo(() => {
    const mod = modules.find((m) => m.id === STRATEGIC_MODULE_ID);
    if (!mod || !isEmbeddedModule(mod)) return isSuperAdmin;
    return canAccessEmbeddedModule(mod, { permissions, modulePermissions: collab?.modulePermissions, isSuperAdmin });
  }, [modules, permissions, collab, isSuperAdmin]);

  const channels = useMemo(() => data?.channels ?? [], [data]);
  const channelName = (id: string) => channels.find((c) => c.id === id)?.name ?? '';

  // Importantes aparecem para todos; as demais, só dos canais que a pessoa segue.
  const feed = useMemo(() => {
    const ranked = rankFeed(data?.posts ?? []);
    if (channelFilter !== 'all') return ranked.filter((p) => p.channelId === channelFilter);
    const followed = new Set(channels.filter((c) => c.following).map((c) => c.id));
    return ranked.filter((p) => p.importance === 'importante' || followed.has(p.channelId));
  }, [data, channels, channelFilter]);

  // Link direto (/inicio?p=<id>), usado pelas notificações e pelo "Copiar link".
  useEffect(() => {
    if (!focusPostId || !data) return;
    document.getElementById(`post-${focusPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusPostId, data]);

  const onFollow = (channelId: string, following: boolean) =>
    follow.mutateAsync({ channelId, following }).catch(() => toast({ title: 'Não foi possível atualizar o canal', variant: 'destructive' }));

  const canPublish = channels.some((c) => c.canPublish);
  const todayRaw = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);
  const notInPilot = error instanceof HubApiError && error.status === 403;

  return (
    <>
      {/* Largura total limitada: o feed fica com ~760px, tamanho confortável de leitura. */}
      <HubPage className="max-w-[1260px]">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-headline text-3xl font-bold sm:text-4xl">{greeting && firstName ? `${greeting}, ${firstName}!` : 'Bem-vindo(a)!'}</h1>
            <p className="mt-1 text-base text-muted-foreground">{today}</p>
          </div>
          {canPublish && (
            <Button onClick={() => setNewPostOpen(true)} size="lg" className="text-base shadow-sm">
              <PenSquare className="mr-2 h-5 w-5" /> Nova publicação
            </Button>
          )}
        </header>

        {notInPilot ? (
          <div className="mx-auto grid max-w-lg justify-items-center gap-3 rounded-xl border bg-card p-10 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <h2 className="font-headline text-xl font-semibold">A nova Home está em piloto</h2>
            <p className="text-muted-foreground">Ela ainda não foi liberada para você. Enquanto isso, o Painel Inicial continua igual.</p>
            <Button asChild variant="outline">
              <Link href="/dashboard">Ir para o Painel Inicial</Link>
            </Button>
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] 2xl:gap-10">
            <main className="flex min-w-0 flex-col gap-5">
              <ChannelChips channels={channels} channelFilter={channelFilter} onChannelFilter={setChannelFilter} onFollow={onFollow} />
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
                      ver tudo
                    </button>
                  </span>
                </div>
              )}

              {isLoading && (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Carregando o feed…
                </div>
              )}
              {error && !notInPilot && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm">Não foi possível carregar o feed. {error.message}</div>
              )}
              {data && feed.length === 0 && (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  {channelFilter === 'all' ? 'Nenhuma publicação ainda.' : 'Nada publicado neste canal ainda.'}
                </div>
              )}
              {data &&
                feed.map((post) => <FeedPost key={post.id} post={post} channelName={channelName(post.channelId)} viewerEmail={data.viewer.email} />)}
            </main>

            <aside className="grid min-w-0 content-start gap-6 md:grid-cols-2 lg:grid-cols-1">
              <Card className="shadow-sm">
                <CardHeader className="flex-row items-center justify-between space-y-0 px-5 pb-4 pt-5">
                  <CardTitle className="font-headline text-lg font-semibold">TrackFlow</CardTitle>
                  <Link href="/trackflow" className="text-sm font-medium text-primary hover:underline">
                    abrir
                  </Link>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <WidgetErrorBoundary title="TrackFlow indisponível">
                    <TrackFlowSummary />
                  </WidgetErrorBoundary>
                </CardContent>
              </Card>
              <IndicatorsCard canSeeStrategic={canSeeStrategic} />
              {/* Ainda com dados de exemplo: pessoas, viagens e férias entram numa etapa seguinte. */}
              <PeoplePanel />
            </aside>
          </section>
        )}
      </HubPage>
      {canPublish && data && <NewPostDialog open={newPostOpen} onOpenChange={setNewPostOpen} channels={channels} viewer={data.viewer} />}
      <VenetoMarketingFooter variant="flow" />
    </>
  );
}
