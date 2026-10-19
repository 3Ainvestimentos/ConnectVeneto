"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VenetoMarketingFooter } from '@/components/layout/VenetoMarketingFooter';
import { canAccessEmbeddedModule } from '@/components/layout/navigation';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';
import { AgendaCard } from '@/components/hub-feed/AgendaCard';
import { AvisosCard } from '@/components/hub-feed/AvisosCard';
import { HubPage } from '@/components/hub-feed/HubPage';
import { StrategicIndicators } from '@/components/hub-feed/IndicatorCards';
import { PeoplePanel } from '@/components/hub-feed/PeoplePanel';
import { PublicacoesFeedCard } from '@/components/hub-feed/PublicacoesFeedCard';
import { TodoCard } from '@/components/hub-feed/TodoCard';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { isEmbeddedModule } from '@/config/modules';
import { HubApiError, useHubFeed } from '@/hooks/useHubFeed';
import { useHubModules } from '@/hooks/useHubModules';
import { findCollaboratorByEmail } from '@/lib/email-utils';

/** Módulo "Dados Estratégicos" (id histórico: portal-repasse). */
const STRATEGIC_MODULE_ID = 'portal-repasse';

/** Último card de cada coluna: estica (lg) para as duas colunas terminarem na mesma altura. */
const STRETCH_LAST = 'min-w-0 lg:order-none lg:flex-1 lg:[&>*]:h-full';

function useGreeting() {
  const [greeting, setGreeting] = useState('');
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite');
  }, []);
  return greeting;
}

/**
 * Home (piloto): o que fazer (To-do), o que saber (Avisos) e o que acompanhar (Agenda,
 * Pessoas e equipes, Indicadores). As Notícias não ficam aqui: chegam pelo Resumo diário e ficam
 * guardadas em /publicacoes.
 */
export default function InicioPage() {
  const { user, permissions, isSuperAdmin } = useAuth();
  const { collaborators } = useCollaborators();
  const { modules } = useHubModules();
  const { error } = useHubFeed();
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

  const todayRaw = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);
  const notInPilot = error instanceof HubApiError && error.status === 403;

  return (
    <>
      {/* Ocupa toda a largura ao lado do menu (aberto ou recolhido): sem vão nem à esquerda nem à direita. */}
      <HubPage className="max-w-none md:mx-0">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-headline text-3xl font-bold sm:text-4xl">{greeting && firstName ? `${greeting}, ${firstName}!` : 'Bem-vindo(a)!'}</h1>
            <p className="mt-1 text-base text-muted-foreground">{today}</p>
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
          // Duas colunas que terminam juntas: o último card de cada uma (Publicações / Agenda e Eventos)
          // estica até a altura da outra. No celular: Avisos → To-do → Agenda e Eventos → Pessoas →
          // Publicações → Indicadores Estratégicos.
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_460px] 2xl:gap-8">
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
              <div className="order-2 min-w-0 lg:order-none">
                <WidgetErrorBoundary title="To-do indisponível">
                  <TodoCard />
                </WidgetErrorBoundary>
              </div>
              {/* Ainda com dados de exemplo: pessoas, viagens e férias entram numa etapa seguinte. */}
              <div className="order-4 min-w-0 lg:order-none">
                <PeoplePanel variant="columns" />
              </div>
              <div className={STRETCH_LAST + ' order-5'}>
                <PublicacoesFeedCard />
              </div>
            </div>

            <aside className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
              {canSeeStrategic && (
                <div className="order-6 min-w-0 lg:order-none">
                  <StrategicIndicators />
                </div>
              )}
              <div className="order-1 min-w-0 lg:order-none">
                <AvisosCard />
              </div>
              <div className={STRETCH_LAST + ' order-3'}>
                <AgendaCard />
              </div>
            </aside>
          </div>
        )}
      </HubPage>
      <VenetoMarketingFooter variant="flow" />
    </>
  );
}
