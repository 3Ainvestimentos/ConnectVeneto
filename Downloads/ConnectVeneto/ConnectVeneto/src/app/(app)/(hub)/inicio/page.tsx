"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FlaskConical, Loader2, Lock, PenSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VenetoMarketingFooter } from '@/components/layout/VenetoMarketingFooter';
import { canAccessEmbeddedModule } from '@/components/layout/navigation';
import TrackFlowSummary from '@/components/dashboard-v2/TrackFlowSummary';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';
import { ChannelChips } from '@/components/hub-feed/ChannelChips';
import { FeedPost } from '@/components/hub-feed/FeedPost';
import { HubDigestModal } from '@/components/hub-feed/HubDigestModal';
import { HubPage } from '@/components/hub-feed/HubPage';
import { IndicatorsCard } from '@/components/hub-feed/IndicatorsCard';
import { NewPostDialog } from '@/components/hub-feed/NewPostDialog';
import { PeoplePanel } from '@/components/hub-feed/PeoplePanel';
import { PeriodFilter } from '@/components/hub-feed/PeriodFilter';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { isEmbeddedModule } from '@/config/modules';
import { HubApiError, useHubFeed, useHubFeedActions } from '@/hooks/useHubFeed';
import { useHubModules } from '@/hooks/useHubModules';
import { toast } from '@/hooks/use-toast';
import { findCollaboratorByEmail } from '@/lib/email-utils';
import { happeningAt, happensIn, periodRange, type Period } from '@/lib/hub/periods';
import { isHighlighted, rankFeed } from '@/lib/hub/ranking';

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
  const [period, setPeriod] = useState<Period>('all');
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [digestTestOpen, setDigestTestOpen] = useState(false);
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

  // Feed principal ("Destaques"): só Importantes ainda no período de destaque; depois da data elas
  // ficam só no canal. Num canal: tudo dele, inclusive as Normais (que chegam pelo Resumo diário).
  // Com "Acontece em": eventos e enquetes da janela (destaques + canais seguidos), por data.
  const feed = useMemo(() => {
    const ranked = rankFeed(data?.posts ?? []);
    if (period !== 'all') {
      const range = periodRange(period);
      const followed = new Set(channels.filter((c) => c.following).map((c) => c.id));
      return ranked
        .filter((p) => (channelFilter !== 'all' ? p.channelId === channelFilter : isHighlighted(p) || followed.has(p.channelId)))
        .filter((p) => happensIn(p, range))
        .sort((a, b) => (happeningAt(a)?.getTime() ?? 0) - (happeningAt(b)?.getTime() ?? 0));
    }
    if (channelFilter !== 'all') return ranked.filter((p) => p.channelId === channelFilter);
    return ranked.filter((p) => isHighlighted(p));
  }, [data, channels, channelFilter, period]);

  // Normais que chegaram nos canais seguidos depois do último Resumo diário.
  const newCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!data?.digestSeenAt) return counts;
    for (const p of data.posts) {
      if (p.importance === 'normal' && p.createdAt > data.digestSeenAt && p.authorEmail !== data.viewer.email) {
        counts[p.channelId] = (counts[p.channelId] ?? 0) + 1;
      }
    }
    return counts;
  }, [data]);

  // Link direto (/inicio?p=<id>), usado pelas notificações, pelo Resumo e pelo "Copiar link".
  // Uma Normal não está em "Destaques": abre o canal dela antes de rolar.
  const focusHandled = useRef<string | null>(null);
  useEffect(() => {
    if (!focusPostId || !data || focusHandled.current === focusPostId) return;
    const target = data.posts.find((p) => p.id === focusPostId);
    if (target && !feed.some((p) => p.id === focusPostId)) {
      setPeriod('all');
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
  const todayRaw = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);
  const notInPilot = error instanceof HubApiError && error.status === 403;

  return (
    <>
      {/* Alinhada ao menu (sem centralizar): em telas largas a sobra fica à direita, não entre o menu e o feed. */}
      <HubPage className="max-w-[1320px] md:mx-0">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-headline text-3xl font-bold sm:text-4xl">{greeting && firstName ? `${greeting}, ${firstName}!` : 'Bem-vindo(a)!'}</h1>
            <p className="mt-1 text-base text-muted-foreground">{today}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Só para quem gerencia conteúdo: simula o Resumo diário sem marcar como visto. */}
            {data?.viewer.isContentManager && (
              <Button onClick={() => setDigestTestOpen(true)} size="lg" variant="outline" className="text-base">
                <FlaskConical className="mr-2 h-5 w-5" /> Testar resumo
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
              <div className="grid gap-3">
                <ChannelChips channels={channels} channelFilter={channelFilter} onChannelFilter={setChannelFilter} onFollow={onFollow} newCounts={newCounts} />
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  {channelFilter === 'all' && (
                    <p className="text-sm text-muted-foreground">Mostrando as publicações em destaque. Escolha um canal para ver tudo dele.</p>
                  )}
                  <PeriodFilter value={period} onChange={setPeriod} className="ml-auto" />
                </div>
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
                      voltar aos destaques
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
                  {period !== 'all' ? 'Nada marcado para este período.' : channelFilter === 'all' ? 'Nenhum destaque no momento.' : 'Nada publicado neste canal ainda.'}
                </div>
              )}
              {data &&
                feed.map((post) => <FeedPost key={post.id} post={post} channelName={channelName(post.channelId)} viewerEmail={data.viewer.email} />)}
            </main>

            <aside className="grid min-w-0 content-start gap-6 md:grid-cols-2 lg:grid-cols-1">
              <Card className="shadow-sm">
                <CardHeader className="px-5 pb-3 pt-5">
                  <CardTitle className="font-headline text-lg font-semibold">TrackFlow</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <WidgetErrorBoundary title="TrackFlow indisponível">
                    <TrackFlowSummary variant="compact" />
                  </WidgetErrorBoundary>
                </CardContent>
              </Card>
              {/* Ainda com dados de exemplo: pessoas, viagens e férias entram numa etapa seguinte. */}
              <PeoplePanel />
              <IndicatorsCard canSeeStrategic={canSeeStrategic} />
            </aside>
          </section>
        )}
      </HubPage>
      {canPublish && data && <NewPostDialog open={newPostOpen} onOpenChange={setNewPostOpen} channels={channels} viewer={data.viewer} />}
      {digestTestOpen && <HubDigestModal forceOpen onOpenChange={setDigestTestOpen} />}
      <VenetoMarketingFooter variant="flow" />
    </>
  );
}
