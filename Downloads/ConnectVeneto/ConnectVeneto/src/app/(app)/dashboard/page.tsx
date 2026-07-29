
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Image from 'next/image';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuickLinks } from '@/contexts/QuickLinksContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import GoogleCalendar from '@/components/dashboard-v2/GoogleCalendar';
import TrackFlowSummary from '@/components/dashboard-v2/TrackFlowSummary';
import NewsHighlights from '@/components/dashboard-v2/NewsHighlights';
import TradingViewWidget from '@/components/dashboard-v2/TradingViewWidget';
import { findCollaboratorByEmail } from '@/lib/email-utils';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';
import { bootstrapTrace } from '@/lib/bootstrap-trace';
import { VenetoMarketingFooter } from '@/components/layout/VenetoMarketingFooter';

export default function DashboardV2Page() {
  const [greeting, setGreeting] = useState('');

  const { user } = useAuth();
  const { collaborators } = useCollaborators();
  const { getVisibleLinksForUser } = useQuickLinks();

  const currentUserCollab = useMemo(() => {
      if (!user || !collaborators) return null;
      return findCollaboratorByEmail(collaborators, user.email) || null;
  }, [user, collaborators]);

  useEffect(() => {
    bootstrapTrace('dashboard_mount');
  }, []);

  useEffect(() => {
    const getGreeting = () => {
      if (typeof window === 'undefined') return '';
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) return 'Bom dia';
      if (hour >= 12 && hour < 18) return 'Boa tarde';
      return 'Boa noite';
    };
    setGreeting(getGreeting());
  }, []);

  const pageTitle = useMemo(() => {
    const userName = currentUserCollab?.name?.split(' ')[0] || user?.displayName?.split(' ')[0];
    if (!greeting || !userName) return "Bem-vindo(a)!";
    return `${greeting}, ${userName}!`;
  }, [greeting, user, currentUserCollab]);

  const quickLinks = useMemo(() => {
    return getVisibleLinksForUser(currentUserCollab, collaborators);
  }, [currentUserCollab, collaborators, getVisibleLinksForUser]);

  useEffect(() => {
    bootstrapTrace('dashboard_ready_state', {
      hasUser: !!user,
      hasCollaborator: !!currentUserCollab,
      quickLinks: quickLinks.length,
    });
  }, [user, currentUserCollab, quickLinks.length]);

  return (
    <>
      <div className="space-y-6 p-6 md:p-8 overflow-x-hidden">
        <section>
          <PageHeader
            title={pageTitle}
            description="Veja os eventos e links rápidos da empresa."
          />
        </section>

        {/* Layout principal: TrackFlow à esquerda, widgets na coluna direita */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6 md:items-start">

          {/* Coluna esquerda — TrackFlow + Notícias */}
          <div className="md:col-span-9 min-w-0 flex flex-col gap-6">

            <div className="rounded-xl border border-border bg-background shadow-sm">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-headline text-foreground text-xl font-semibold">TrackFlow</h2>
              </div>
              <div className="p-6">
                <WidgetErrorBoundary title="TrackFlow indisponível">
                  <TrackFlowSummary />
                </WidgetErrorBoundary>
              </div>
            </div>

            <Card className="shadow-sm w-full flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="font-headline text-foreground text-xl">Notícias</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <WidgetErrorBoundary title="Notícias indisponível">
                  <NewsHighlights />
                </WidgetErrorBoundary>
              </CardContent>
            </Card>
          </div>

          {/* Coluna direita — Calendário + Links Rápidos */}
          <div className="md:col-span-3 min-w-0 flex flex-col gap-6">

            <GoogleCalendar />

            <Card className="shadow-sm w-full flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="font-headline text-foreground text-xl">Índices de Mercado</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 h-[400px]">
                <WidgetErrorBoundary title="Índices de Mercado indisponível">
                  <TradingViewWidget />
                </WidgetErrorBoundary>
              </CardContent>
            </Card>

            {quickLinks.length > 0 && (
              <Card className="shadow-sm w-full flex flex-col">
                <CardHeader>
                  <CardTitle className="font-headline text-foreground text-xl">Links Rápidos</CardTitle>
                  <CardDescription>Acesse sistemas e recursos.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow min-h-0 overflow-y-auto">
                  <div className="flex flex-col gap-3">
                    {quickLinks.map((link) => (
                      <a
                        href={link.link}
                        key={link.id}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted transition-colors bg-card dark:bg-white w-full group relative overflow-hidden h-16"
                        title={link.name || 'Link rápido'}
                      >
                        <div className="relative w-20 h-full shrink-0 flex items-center justify-center">
                          <Image
                            src={link.imageUrl}
                            alt={link.name || 'Link rápido'}
                            fill
                            className="object-contain p-1 transition-transform group-hover:scale-105"
                          />
                        </div>
                        {link.name ? (
                          <span className="text-sm font-medium truncate text-foreground flex-1">{link.name}</span>
                        ) : null}
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

        </section>
      </div>
      <VenetoMarketingFooter variant="flow" />
    </>
  );
}
