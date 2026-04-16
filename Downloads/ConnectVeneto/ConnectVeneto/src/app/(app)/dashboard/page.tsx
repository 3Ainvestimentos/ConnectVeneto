
"use client"; 

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Image from 'next/image';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuickLinks } from '@/contexts/QuickLinksContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import GoogleCalendar from '@/components/dashboard-v2/GoogleCalendar';
import RssFeed from '@/components/dashboard-v2/RssFeed';
import TradingViewWidget from '@/components/dashboard-v2/TradingViewWidget';
import NewsHighlights from '@/components/dashboard-v2/NewsHighlights';
import { useContacts } from '@/contexts/ContactsContext';
import { findCollaboratorByEmail } from '@/lib/email-utils';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';
import { bootstrapTrace } from '@/lib/bootstrap-trace';
import { VenetoMarketingFooter } from '@/components/layout/VenetoMarketingFooter';

export default function DashboardV2Page() {
  const [greeting, setGreeting] = useState('');

  const { user } = useAuth();
  const { collaborators } = useCollaborators();
  const { getVisibleLinksForUser } = useQuickLinks();
  const { contacts } = useContacts();
  
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
      contacts: contacts.length,
    });
  }, [user, currentUserCollab, quickLinks.length, contacts.length]);

  return (
    <>
      <div className="space-y-6 p-6 md:p-8 overflow-x-hidden">
        <section>
          <PageHeader
            title={pageTitle}
            description="Veja os eventos e links rápidos da empresa."
          />
        </section>

        <NewsHighlights />

        <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-9 min-w-0">
            <WidgetErrorBoundary title="Feed RSS indisponível">
              <RssFeed />
            </WidgetErrorBoundary>
          </div>
          <div className="md:col-span-3 min-w-0 flex">
            <Card className="h-full w-full flex flex-col">
              <CardHeader>
                <Image src="https://firebasestorage.googleapis.com/v0/b/a-riva-hub.firebasestorage.app/o/Imagens%20institucionais%20(logos%20e%20etc)%2FTradingView-Logo.png?alt=media&token=197efd23-e52d-42d2-8554-424ad5df43a4" alt="TradingView Logo" width={195} height={52} />
                 <CardDescription>
                    Algumas cotações tem atrasos de 15min
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <WidgetErrorBoundary title="TradingView indisponível">
                  <TradingViewWidget />
                </WidgetErrorBoundary>
              </CardContent>
            </Card>
          </div>
        </section>
        
        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 md:items-stretch gap-6">
            <div className="md:col-span-6 min-w-0">
              <GoogleCalendar />
            </div>
            <div className="md:col-span-3 min-w-0 flex">
              <Card className="shadow-sm w-full h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="font-headline text-foreground text-xl">Contatos</CardTitle>
                  <CardDescription>Contato dos responsáveis da empresa.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow min-h-0 overflow-y-auto pt-0">
                  {contacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4">Nenhum contato encontrado.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {contacts.map((contact) => (
                        <a
                          href={contact.slackUrl}
                          key={contact.id}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted transition-colors bg-card dark:bg-white w-full group relative overflow-hidden h-16"
                          title={contact.area}
                        >
                          <div className="relative w-20 h-full shrink-0 flex items-center justify-center">
                            <Image
                              src="https://firebasestorage.googleapis.com/v0/b/veneto-connect.firebasestorage.app/o/Logos%20e%20imagens%20institucionais%2FGoogle_Chat_icon_(2023).svg.png?alt=media&token=817ca5a7-e327-47cc-8391-e02f215c0dce"
                              alt="Google Chat Icon"
                              fill
                              className="object-contain p-1 transition-transform group-hover:scale-105"
                            />
                          </div>
                          <div className="flex flex-1 min-w-0 items-center">
                            <div className="flex min-w-0 flex-col justify-center leading-tight">
                              <span className="truncate text-sm font-medium text-foreground">{contact.area}</span>
                              {contact.manager ? (
                                <span className="truncate text-xs text-muted-foreground">{contact.manager}</span>
                              ) : null}
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="md:col-span-3 min-w-0 flex">
              <Card className="shadow-sm w-full h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="font-headline text-foreground text-xl">Links Rápidos</CardTitle>
                  <CardDescription>Acesse sistemas e recursos.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow min-h-0 overflow-y-auto">
                  {quickLinks.length > 0 ? (
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
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
      <VenetoMarketingFooter variant="flow" />
    </>
  );
}

