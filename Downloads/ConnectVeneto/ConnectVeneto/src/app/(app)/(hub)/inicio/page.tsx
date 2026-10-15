"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PenSquare } from 'lucide-react';
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
import { WireframeBar } from '@/components/hub-feed/WireframeBar';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { useNews } from '@/contexts/NewsContext';
import { isEmbeddedModule } from '@/config/modules';
import { useHubModules } from '@/hooks/useHubModules';
import { findCollaboratorByEmail } from '@/lib/email-utils';
import { newsToPosts } from '@/lib/hub-mock/news-adapter';
import { rankFeed } from '@/lib/hub-mock/ranking';
import { useHubMock } from '@/lib/hub-mock/store';

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
  const { newsItems } = useNews();
  const { posts, following, publishableChannels, channelById, me, syncExternalPosts } = useHubMock();
  const [channelFilter, setChannelFilter] = useState('all');
  const [newPostOpen, setNewPostOpen] = useState(false);
  const greeting = useGreeting();

  // Notícias publicadas pelo RH (dado real) entram no feed como Publicações do canal Institucional.
  useEffect(() => {
    if (newsItems.length) syncExternalPosts(newsToPosts(newsItems));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newsItems]);

  const collab = useMemo(
    () => (user ? findCollaboratorByEmail(collaborators, user.email) ?? null : null),
    [user, collaborators],
  );
  const firstName = collab?.name?.split(' ')[0] || user?.displayName?.split(' ')[0] || me.name.split(' ')[0];

  const canSeeStrategic = useMemo(() => {
    const mod = modules.find((m) => m.id === STRATEGIC_MODULE_ID);
    if (!mod || !isEmbeddedModule(mod)) return isSuperAdmin;
    return canAccessEmbeddedModule(mod, { permissions, modulePermissions: collab?.modulePermissions, isSuperAdmin });
  }, [modules, permissions, collab, isSuperAdmin]);

  // Importantes aparecem para todos; as demais, só dos canais que a pessoa segue.
  const feed = useMemo(() => {
    const ranked = rankFeed(posts);
    if (channelFilter !== 'all') return ranked.filter((p) => p.channelId === channelFilter);
    return ranked.filter((p) => p.importance === 'importante' || following.includes(p.channelId));
  }, [posts, following, channelFilter]);

  const canPublish = publishableChannels.length > 0;
  const todayRaw = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  return (
    <>
      {/* Largura total limitada: o feed fica com ~760px, tamanho confortável de leitura. */}
      <HubPage className="max-w-[1260px]">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-headline text-3xl font-bold sm:text-4xl">{greeting ? `${greeting}, ${firstName}!` : 'Bem-vindo(a)!'}</h1>
            <p className="mt-1 text-base text-muted-foreground">{today}</p>
          </div>
          {canPublish && (
            <Button onClick={() => setNewPostOpen(true)} size="lg" className="text-base shadow-sm">
              <PenSquare className="mr-2 h-5 w-5" /> Nova publicação
            </Button>
          )}
        </header>
        <WireframeBar />

        {/* Feed à esquerda, painéis à direita a partir de lg; abaixo disso tudo em uma coluna. */}
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] 2xl:gap-10">
          <main className="flex min-w-0 flex-col gap-5">
            <ChannelChips channelFilter={channelFilter} onChannelFilter={setChannelFilter} />
            {channelFilter !== 'all' && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-4 py-3 text-base">
                <span>
                  Mostrando só <b>{channelById(channelFilter).name}</b>
                </span>
                <button type="button" onClick={() => setChannelFilter('all')} className="font-medium text-primary hover:underline">
                  ver tudo
                </button>
              </div>
            )}

            {feed.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nada publicado neste canal ainda.</div>
            )}
            {feed.map((post) => (
              <FeedPost key={post.id} post={post} />
            ))}
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
            <PeoplePanel />
          </aside>
        </section>
      </HubPage>
      {canPublish && <NewPostDialog open={newPostOpen} onOpenChange={setNewPostOpen} />}
      <VenetoMarketingFooter variant="flow" />
    </>
  );
}
