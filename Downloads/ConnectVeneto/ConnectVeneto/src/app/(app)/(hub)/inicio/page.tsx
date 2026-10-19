"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ListChecks, Lock, Newspaper, PenSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { VenetoMarketingFooter } from '@/components/layout/VenetoMarketingFooter';
import { canAccessEmbeddedModule } from '@/components/layout/navigation';
import TrackFlowSummary from '@/components/dashboard-v2/TrackFlowSummary';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';
import { AgendaCard } from '@/components/hub-feed/AgendaCard';
import { AvisosCard } from '@/components/hub-feed/AvisosCard';
import { HubPage } from '@/components/hub-feed/HubPage';
import { IndicatorsStrip } from '@/components/hub-feed/IndicatorsStrip';
import { NewPostDialog } from '@/components/hub-feed/NewPostDialog';
import { PeoplePanel } from '@/components/hub-feed/PeoplePanel';
import { PublicacoesMiniCard } from '@/components/hub-feed/PublicacoesMiniCard';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { isEmbeddedModule } from '@/config/modules';
import { HubApiError, useHubFeed } from '@/hooks/useHubFeed';
import { useHubModules } from '@/hooks/useHubModules';
import { findCollaboratorByEmail } from '@/lib/email-utils';
import { countNewSince } from '@/lib/hub/home';

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

/**
 * Home (piloto): o que fazer (Pendências), o que saber (Avisos) e o que acompanhar (Agenda,
 * Pessoas e equipes, Indicadores). As Notícias não ficam aqui: chegam pelo Resumo diário e ficam
 * guardadas em /publicacoes.
 */
export default function InicioPage() {
  const { user, permissions, isSuperAdmin } = useAuth();
  const { collaborators } = useCollaborators();
  const { modules } = useHubModules();
  const { data, error } = useHubFeed();
  const [newPostOpen, setNewPostOpen] = useState(false);
  const greeting = useGreeting();
  const router = useRouter();
  const legacyPostId = useSearchParams().get('p');

  // Links antigos (/inicio?p=<id>, de notificações já enviadas) vão para a publicação.
  useEffect(() => {
    if (legacyPostId) router.replace(`/publicacoes?p=${encodeURIComponent(legacyPostId)}`);
  }, [legacyPostId, router]);

  const collab = useMemo(() => (user ? findCollaboratorByEmail(collaborators, user.email) ?? null : null), [user, collaborators]);
  const firstName = collab?.name?.split(' ')[0] || user?.displayName?.split(' ')[0] || '';

  const canSeeStrategic = useMemo(() => {
    const mod = modules.find((m) => m.id === STRATEGIC_MODULE_ID);
    if (!mod || !isEmbeddedModule(mod)) return isSuperAdmin;
    return canAccessEmbeddedModule(mod, { permissions, modulePermissions: collab?.modulePermissions, isSuperAdmin });
  }, [modules, permissions, collab, isSuperAdmin]);

  const channels = useMemo(() => data?.channels ?? [], [data]);
  const fresh = data
    ? countNewSince(
        data.posts,
        channels.filter((c) => c.following).map((c) => c.id),
        data.digestSeenAt,
        data.viewer.email,
      )
    : 0;
  const canPublish = channels.some((c) => c.canPublish);
  const todayRaw = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);
  const notInPilot = error instanceof HubApiError && error.status === 403;

  return (
    <>
      {/* Alinhada ao menu (sem centralizar): em telas largas a sobra fica à direita. */}
      <HubPage className="max-w-[1320px] md:mx-0">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-headline text-3xl font-bold sm:text-4xl">{greeting && firstName ? `${greeting}, ${firstName}!` : 'Bem-vindo(a)!'}</h1>
            <p className="mt-1 text-base text-muted-foreground">{today}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg" variant="outline" className="text-base">
              <Link href="/publicacoes">
                <Newspaper className="mr-2 h-5 w-5" /> Publicações
                {fresh > 0 && (
                  <span className="ml-2 min-w-6 rounded-full bg-primary px-1.5 text-center text-xs font-bold leading-6 text-primary-foreground" aria-label={`${fresh} novas`}>
                    {fresh > 9 ? '9+' : fresh}
                  </span>
                )}
              </Link>
            </Button>
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
          // Celular: Avisos → Pendências → Indicadores → Agenda → Pessoas → Publicações.
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px] 2xl:gap-8">
            <div className="order-3 min-w-0 lg:order-none lg:col-span-2">
              <IndicatorsStrip canSeeStrategic={canSeeStrategic} />
            </div>

            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
              <Card className="order-2 shadow-sm lg:order-none">
                <div className="flex items-center justify-between gap-2 px-5 pt-5">
                  <h2 className="inline-flex items-center gap-2 font-headline text-lg font-semibold">
                    <ListChecks className="h-5 w-5 text-primary" aria-hidden /> Pendências
                  </h2>
                  <Link href="/trackflow" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    TrackFlow <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="px-5 pb-5 pt-4">
                  <WidgetErrorBoundary title="TrackFlow indisponível">
                    <TrackFlowSummary variant="wide" />
                  </WidgetErrorBoundary>
                </div>
              </Card>
              <div className="order-4 min-w-0 lg:order-none">
                <AgendaCard />
              </div>
              {/* Ainda com dados de exemplo: pessoas, viagens e férias entram numa etapa seguinte. */}
              <div className="order-5 min-w-0 lg:order-none">
                <PeoplePanel variant="columns" />
              </div>
            </div>

            <aside className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
              <div className="order-1 min-w-0 lg:order-none">
                <AvisosCard />
              </div>
              <div className="order-6 min-w-0 lg:order-none">
                <PublicacoesMiniCard />
              </div>
            </aside>
          </div>
        )}
      </HubPage>
      {canPublish && data && <NewPostDialog open={newPostOpen} onOpenChange={setNewPostOpen} channels={channels} viewer={data.viewer} />}
      <VenetoMarketingFooter variant="flow" />
    </>
  );
}
