
"use client"; 

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  CalendarDays, MapPin
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNews, type NewsItemType } from '@/contexts/NewsContext';
import { useEvents } from '@/contexts/EventsContext';
import { useQuickLinks } from '@/contexts/QuickLinksContext';
import { getIcon } from '@/lib/icons';
import { useAuth } from '@/contexts/AuthContext';
import { getCollaboratorUserId, useCollaborators } from '@/contexts/CollaboratorsContext';
import { isSameMonth, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { addDocumentToCollection } from '@/lib/firestore-service';
import { ptBR } from 'date-fns/locale';
import { findCollaboratorByEmail } from '@/lib/email-utils';


export default function DashboardPage() {
  const [displayedMonth, setDisplayedMonth] = useState<Date>(new Date());
  const [selectedNews, setSelectedNews] = useState<NewsItemType | null>(null);
  const [greeting, setGreeting] = useState('');

  // Get global data from contexts
  const { user } = useAuth();
  const { collaborators } = useCollaborators();
  const { events, getEventRecipients } = useEvents();
  const { newsItems } = useNews();
  const { getVisibleLinksForUser } = useQuickLinks();
  
  const currentUserCollab = useMemo(() => {
      if (!user || !collaborators) return null;
      return findCollaboratorByEmail(collaborators, user.email) || null;
  }, [user, collaborators]);

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
    if (!greeting || !user?.displayName) return "Bem-vindo(a)!";
    return `${greeting}, ${user.displayName.split(' ')[0]}!`;
  }, [greeting, user]);


  const userEvents = useMemo(() => {
      if (!currentUserCollab) return [];
      
      return events.filter(event => {
          const recipients = getEventRecipients(event, collaborators);
          return recipients.some(r => getCollaboratorUserId(r) === getCollaboratorUserId(currentUserCollab));
      });
  }, [events, currentUserCollab, collaborators, getEventRecipients]);

  const quickLinks = useMemo(() => {
    return getVisibleLinksForUser(currentUserCollab, collaborators);
  }, [currentUserCollab, collaborators, getVisibleLinksForUser]);

  const eventsForMonth = useMemo(() => {
    if (!displayedMonth) return [];
    const timeZone = 'America/Sao_Paulo';
    return userEvents
      .filter(event => {
        const eventDateInSaoPaulo = toZonedTime(parseISO(event.date), timeZone);
        const displayedMonthInSaoPaulo = toZonedTime(displayedMonth, timeZone);
        return isSameMonth(eventDateInSaoPaulo, displayedMonthInSaoPaulo);
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [userEvents, displayedMonth]);
  
  const eventDates = useMemo(() => userEvents.map(e => toZonedTime(parseISO(e.date), 'UTC')), [userEvents]);

  const activeHighlights = useMemo(() => newsItems.filter(item => item.isHighlight), [newsItems]);

  const logContentView = (item: NewsItemType) => {
    if (!currentUserCollab) return;
    addDocumentToCollection('audit_logs', {
        eventType: 'content_view',
        userId: getCollaboratorUserId(currentUserCollab),
        userName: currentUserCollab.name,
        timestamp: new Date().toISOString(),
        details: {
            contentId: item.id,
            contentTitle: item.title,
            contentType: 'news'
        }
    }).catch(console.error); // Log silently
  };

  const handleViewNews = (item: NewsItemType) => {
      setSelectedNews(item);
      logContentView(item);
  };

  const renderHighlights = () => {
      switch (activeHighlights.length) {
          case 1:
              return <HighlightCard item={activeHighlights[0]} />;
          case 2:
              return (
                  <>
                      <HighlightCard item={activeHighlights[0]} />
                      <HighlightCard item={activeHighlights[1]} />
                  </>
              );
          case 3:
              return (
                  <>
                      <HighlightCard item={activeHighlights[0]} />
                      <HighlightCard item={activeHighlights[1]} className="md:row-span-2" />
                      <HighlightCard item={activeHighlights[2]} />
                  </>
              );
          default:
              return null;
      }
  };
  
  const getGridClass = () => {
    switch (activeHighlights.length) {
      case 1:
        return "grid-cols-1";
      case 2:
        return "grid-cols-1 md:grid-cols-2";
      case 3:
        return "grid-cols-1 md:grid-cols-2 md:grid-rows-2";
      default:
        return "grid-cols-1";
    }
  }

  const HighlightCard = ({ item, className = "" }: { item: NewsItemType, className?: string }) => (
    <div 
        className={cn("relative rounded-lg overflow-hidden group block cursor-pointer", className)}
        onClick={() => handleViewNews(item)}
        onKeyDown={(e) => e.key === 'Enter' && handleViewNews(item)}
        tabIndex={0}
        role="button"
        aria-label={`Ver notícia: ${item.title}`}
    >
        <Image src={item.imageUrl} alt={item.title} layout="fill" objectFit="cover" className="transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-4 flex flex-col justify-end">
            <h3 className="text-xl font-headline font-bold text-white">{item.title}</h3>
            <p className="text-sm text-gray-200 font-body">{item.snippet}</p>
        </div>
    </div>
  );

  return (
    <>
      <div className="space-y-6 p-6 md:p-8">
        {activeHighlights.length > 0 && (
          <section>
            <PageHeader
              title={pageTitle}
              description="Veja os últimos anúncios e destaques."
            />
            <div className={cn("grid gap-3", getGridClass())} style={{ minHeight: '450px' }}>
              {renderHighlights()}
            </div>
          </section>
        )}
        
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Main Content Column */}
          <div className="lg:col-span-2 flex flex-col gap-3">
              {/* Quick Links Card */}
              {quickLinks.length > 0 && (
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="font-headline text-foreground text-xl">Links Rápidos</CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <div className="flex justify-center flex-wrap gap-3">
                          {quickLinks.map(link => (
                              <a 
                                 href={link.link} 
                                 key={link.id} 
                                 target="_blank" 
                                 rel="noopener noreferrer" 
                                 className="block relative overflow-hidden rounded-lg transition-opacity hover:opacity-80 bg-card dark:bg-white aspect-video w-32"
                                 title={link.name || 'Link Rápido'}
                               >
                                  <Image
                                      src={link.imageUrl}
                                      alt={link.name || 'Quick Link'}
                                      layout="fill"
                                      objectFit="contain"
                                      className="p-2"
                                  />
                              </a>
                          ))}
                        </div>
                    </CardContent>
                </Card>
              )}
          </div>
            
          {/* Sidebar Column */}
          <div className="lg:col-span-1">
             {/* Events Card */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="font-headline text-foreground text-xl flex items-center gap-2">
                    Eventos
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 lg:grid-cols-1 gap-6">
                    <div className="md:col-span-2 lg:col-span-1 flex items-start justify-center">
                        <Calendar
                            mode="single"
                            selected={undefined}
                            onSelect={undefined}
                            className="rounded-md border no-day-hover"
                            month={displayedMonth}
                            onMonthChange={setDisplayedMonth}
                            modifiers={{ event: eventDates }}
                            modifiersClassNames={{
                              event: 'bg-muted rounded-full',
                              today: 'bg-muted-foreground/40 text-foreground rounded-full',
                            }}
                            locale={ptBR}
                        />
                    </div>
                    <div className="md:col-span-2 lg:col-span-1 relative min-h-[200px]">
                      <ScrollArea className="h-full pr-4 absolute inset-0">
                          <div className="space-y-4">
                          {eventsForMonth.map((event, index) => {
                            const Icon = getIcon(event.icon) as LucideIcon;
                            return (
                              <div key={index} className="flex items-start gap-4 p-3 bg-muted/40 rounded-lg">
                                <div className="flex-shrink-0 bg-secondary text-secondary-foreground rounded-lg flex items-center justify-center h-10 w-10">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex-grow">
                                    <p className="font-semibold font-body text-sm text-foreground">{event.title}</p>
                                    <p className="text-xs text-muted-foreground font-body flex items-center mt-1">
                                      <CalendarDays className="h-3 w-3 mr-1.5" />
                                      {new Date(event.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                    </p>
                                    <p className="text-xs text-muted-foreground font-body flex items-center mt-1">
                                      <Clock className="h-3 w-3 mr-1.5" />
                                      {event.time}
                                    </p>
                                    <p className="text-xs text-muted-foreground font-body flex items-center mt-1">
                                      <MapPin className="h-3 w-3 mr-1.5" />
                                      {event.location}
                                    </p>
                                </div>
                              </div>
                           )})}
                           {eventsForMonth.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                                <CalendarDays className="h-8 w-8 mb-2"/>
                                <p className="font-body text-sm">Nenhum evento para o mês selecionado.</p>
                            </div>
                           )}
                          </div>
                      </ScrollArea>
                    </div>
                </CardContent>
              </Card>
          </div>
        </section>
      </div>

      <Dialog open={!!selectedNews} onOpenChange={(isOpen) => !isOpen && setSelectedNews(null)}>
        <DialogContent className="max-w-2xl">
          {selectedNews && (
            <>
              <DialogHeader>
                <div className="relative w-full h-64 rounded-lg overflow-hidden mb-4">
                    <Image
                        src={selectedNews.imageUrl}
                        alt={selectedNews.title}
                        layout="fill"
                        objectFit="cover"
                    />
                </div>
                <DialogTitle className="font-headline text-2xl text-left">{selectedNews.title}</DialogTitle>
                <div className="text-left !mt-2">
                    <Badge variant="outline" className="font-body text-foreground">{selectedNews.category}</Badge>
                    <span className="text-xs text-muted-foreground font-body ml-2">
                        {new Date(selectedNews.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                </div>
              </DialogHeader>
              <ScrollArea className="max-h-[40vh] pr-4">
                <div className="py-4 text-sm text-foreground space-y-4">
                  {selectedNews.content && selectedNews.content.split('\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </ScrollArea>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="hover:bg-muted">Fechar</Button>
                </DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
