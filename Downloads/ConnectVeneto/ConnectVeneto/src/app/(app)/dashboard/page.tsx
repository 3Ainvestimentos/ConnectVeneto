
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

        <section className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-3/4">
            <WidgetErrorBoundary title="Feed RSS indisponível">
              <RssFeed />
            </WidgetErrorBoundary>
          </div>
          <div className="w-full md:w-1/4">
            <Card className="h-full flex flex-col">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div>
                    <GoogleCalendar />
                 </div>
                <div>
                    <Card className="shadow-sm w-full h-full flex flex-col">
                        <CardHeader>
                            <CardTitle className="font-headline text-foreground text-xl">Contatos</CardTitle>
                            <CardDescription>Canal Slack dos responsáveis pelas áreas da empresa.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            {contacts.length === 0 ? (
                                <p className="text-sm text-muted-foreground p-4">Nenhum contato encontrado.</p>
                            ) : (
                                <div className="space-y-2">
                                    {contacts.map(contact => (
                                         <a href={contact.slackUrl} key={contact.id} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm p-2 rounded-md hover:bg-muted">
                                            <Image src="https://firebasestorage.googleapis.com/v0/b/a-riva-hub.firebasestorage.app/o/Imagens%20institucionais%20(logos%20e%20etc)%2Ficons8-slack-new-48.png?alt=media&token=7a2d489c-3501-4b01-a206-32673c8a8a99" alt="Slack icon" width={16} height={16} />
                                            <div className="truncate">
                                                <p className="font-semibold truncate">{contact.area}</p>
                                                <p className="text-xs text-muted-foreground truncate">{contact.manager}</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
            {quickLinks.length > 0 && (
                <Card className="shadow-sm w-full">
                    <CardHeader>
                        <CardTitle className="font-headline text-foreground text-xl">Links Rápidos</CardTitle>
                        <CardDescription>Acesse sistemas e recursos.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap justify-center gap-4">
                            {quickLinks.map(link => (
                                <a
                                    href={link.link}
                                    key={link.id}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center p-2 rounded-md hover:bg-muted transition-colors shrink-0"
                                    title={link.name || 'Link Rápido'}
                                >
                                    <span className="shrink-0 w-32 h-12 flex items-center justify-center bg-card dark:bg-white rounded overflow-hidden">
                                        <Image
                                            src={link.imageUrl}
                                            alt={link.name || 'Quick Link'}
                                            width={112}
                                            height={40}
                                            className="object-contain p-1"
                                        />
                                    </span>
                                </a>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </section>
      </div>
      <VenetoMarketingFooter variant="flow" />
    </>
  );
}
