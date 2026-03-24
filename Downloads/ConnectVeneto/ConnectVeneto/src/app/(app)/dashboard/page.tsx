
"use client"; 

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, Link as LinkIcon, Trash2, User
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useNews, type NewsItemType } from '@/contexts/NewsContext';
import { useMessages, type MessageType } from '@/contexts/MessagesContext';
import { useQuickLinks } from '@/contexts/QuickLinksContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators, getCollaboratorUserId } from '@/contexts/CollaboratorsContext';
import { toast } from '@/hooks/use-toast';
import { addDocumentToCollection } from '@/lib/firestore-service';
import GoogleCalendar from '@/components/dashboard-v2/GoogleCalendar';
import GoogleDriveFiles from '@/components/dashboard-v2/GoogleDriveFiles';
import RssFeed from '@/components/dashboard-v2/RssFeed';
import TradingViewWidget from '@/components/dashboard-v2/TradingViewWidget';
import BirthdaysTripsCard from '@/components/dashboard-v2/BirthdaysTripsCard';
import { useContacts } from '@/contexts/ContactsContext';
import { findCollaboratorByEmail } from '@/lib/email-utils';

export default function DashboardV2Page() {
  const [selectedMessage, setSelectedMessage] = useState<MessageType | null>(null);
  const [selectedNews, setSelectedNews] = useState<NewsItemType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [greeting, setGreeting] = useState('');

  const { user } = useAuth();
  const { collaborators } = useCollaborators();
  const { messages, markMessageAsRead, getMessageRecipients, markMessageAsDeleted } = useMessages();
  const { newsItems } = useNews();
  const { getVisibleLinksForUser } = useQuickLinks();
  const { contacts } = useContacts();
  
  const currentUserCollab = useMemo(() => {
      if (!user || !collaborators) return null;
      return findCollaboratorByEmail(collaborators, user.email) || null;
  }, [user, collaborators]);
  const currentUserId = useMemo(() => getCollaboratorUserId(currentUserCollab), [currentUserCollab]);

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

  const userMessages = useMemo(() => {
    if (!currentUserCollab || !currentUserId) return [];
    const sortedMessages = [...messages].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
    return sortedMessages.filter(msg => {
        if (msg.deletedBy && msg.deletedBy.includes(currentUserId)) {
            return false;
        }
        const recipients = getMessageRecipients(msg, collaborators);
        return recipients.some(r => getCollaboratorUserId(r) === currentUserId);
    });
  }, [messages, currentUserCollab, currentUserId, collaborators, getMessageRecipients]);
  
  const quickLinks = useMemo(() => {
    return getVisibleLinksForUser(currentUserCollab, collaborators);
  }, [currentUserCollab, collaborators, getVisibleLinksForUser]);

  const unreadCount = useMemo(() => {
    if (!currentUserId) return 0;
    return userMessages.filter(msg => !msg.readBy.includes(currentUserId)).length;
  }, [userMessages, currentUserId]);
  
  const unreadLabel = useMemo(() => {
    if (unreadCount === 0) return null;
    if (unreadCount === 1) return "1 mensagem não lida";
    return `${unreadCount} mensagens não lidas`;
  }, [unreadCount]);

  const activeHighlights = useMemo(() => newsItems.filter(item => item.isHighlight && item.status === 'published').slice(0, 3), [newsItems]);

  const handleViewMessage = (messageToView: MessageType) => {
    if (!currentUserId) return;
    markMessageAsRead(messageToView.id, currentUserId);
    setSelectedMessage(messageToView);
  };

  const logContentView = (item: NewsItemType) => {
    if (!currentUserCollab || !currentUserId) return;
    addDocumentToCollection('audit_logs', {
        eventType: 'content_view',
        userId: currentUserId,
        userName: currentUserCollab.name,
        timestamp: new Date().toISOString(),
        details: {
            contentId: item.id,
            contentTitle: item.title,
            contentType: 'news'
        }
    }).catch(console.error);
  };

  const handleViewNews = (item: NewsItemType) => {
      setSelectedNews(item);
      logContentView(item);
  };
  
  const handleUserDeleteMessage = async () => {
    if (!selectedMessage || !currentUserId || isDeleting) return;
    setIsDeleting(true);
    try {
        await markMessageAsDeleted(selectedMessage.id, currentUserId);
        toast({ title: "Mensagem movida para a lixeira." });
        setSelectedMessage(null);
    } catch (error) {
        toast({ title: "Erro", description: "Não foi possível remover a mensagem.", variant: "destructive" });
    } finally {
        setIsDeleting(false);
    }
  };
  
  const HighlightCard = ({ item, className = "" }: { item: NewsItemType, className?: string }) => (
    <div 
        className={cn("relative rounded-lg overflow-hidden group block cursor-pointer bg-black h-full", className)}
        onClick={() => handleViewNews(item)}
        onKeyDown={(e) => e.key === 'Enter' && handleViewNews(item)}
        tabIndex={0}
        role="button"
        aria-label={`Ver notícia: ${item.title}`}
    >
        {item.videoUrl ? (
             <video
                src={item.videoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            >
                Seu navegador não suporta a tag de vídeo.
            </video>
        ) : (
             <Image src={item.imageUrl} alt={item.title} layout="fill" objectFit="cover" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-4 flex flex-col justify-end">
            <h3 className="text-xl font-headline font-bold text-white">{item.title}</h3>
            <p className="text-sm text-gray-200 font-body">{item.snippet}</p>
        </div>
    </div>
  );

  const renderHighlights = () => {
    const count = activeHighlights.length;

    if (count === 1) {
        return (
            <div className="md:col-span-2 md:row-span-2 h-full min-h-[450px]">
                <HighlightCard item={activeHighlights[0]} className="h-full" />
            </div>
        );
    }

    if (count === 2) {
        return (
            <>
                <div className="md:col-span-1 md:row-span-2 h-full min-h-[250px] md:min-h-0">
                    <HighlightCard item={activeHighlights[0]} className="h-full" />
                </div>
                <div className="md:col-span-1 md:row-span-2 h-full min-h-[250px] md:min-h-0">
                    <HighlightCard item={activeHighlights[1]} className="h-full" />
                </div>
            </>
        );
    }
    
    if (count === 3) {
        const largeHighlight = activeHighlights.find(h => h.highlightType === 'large') || activeHighlights[0];
        const smallHighlights = activeHighlights.filter(h => h.id !== largeHighlight.id).slice(0, 2);
        return (
            <>
                <div className="md:row-span-2 h-full min-h-[250px] md:min-h-0">
                    <HighlightCard item={largeHighlight} className="h-full" />
                </div>
                {smallHighlights.map(item => (
                    <div key={item.id} className="h-full min-h-[220px] md:min-h-0">
                        <HighlightCard item={item} className="h-full" />
                    </div>
                ))}
            </>
        )
    }

    return null;
  }

  return (
    <>
      <div className="space-y-6 p-6 md:p-8 overflow-x-hidden">
        <section>
          <PageHeader
            title={pageTitle}
            description="Veja os últimos anúncios e destaques da empresa."
          />
          {activeHighlights.length > 0 && (
             <div className="grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 gap-3 h-auto md:h-[500px]">
                {renderHighlights()}
            </div>
          )}
        </section>

        <section className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-3/4">
            <RssFeed />
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
                <TradingViewWidget />
              </CardContent>
            </Card>
          </div>
        </section>
        
        <section className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
                 <div className="lg:col-span-3">
                    <GoogleCalendar />
                 </div>
                 <div className="lg:col-span-3">
                    <GoogleDriveFiles />
                 </div>
                <div className="lg:col-span-2">
                    <BirthdaysTripsCard />
                </div>
                <div className="lg:col-span-2">
                    <Card className="shadow-sm w-full h-full flex flex-col">
                        <CardHeader>
                            <CardTitle className="font-headline text-foreground text-xl">Contatos</CardTitle>
                            <CardDescription>Canal Slack dos responsáveis pelas áreas da empresa.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
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
             <Card id="messages-card" className="shadow-sm flex flex-col w-full">
                <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                    <CardTitle className="font-headline text-foreground text-xl">Mensagens</CardTitle>
                    <CardDescription>Comunicados e alertas importantes direcionados a você.</CardDescription>
                    </div>
                    {unreadCount > 0 && (<Badge variant="secondary">{unreadLabel}</Badge>)}
                </div>
                </CardHeader>
                <CardContent className="flex-1 min-h-[300px] relative">
                {userMessages.length > 0 ? (
                    <div className="absolute inset-0">
                        <ScrollArea className="h-full">
                            <div className="space-y-4 p-6 pt-0">
                                {userMessages.map((msg) => {
                                    const isRead = currentUserId ? msg.readBy.includes(currentUserId) : false;
                                    return (
                                    <div key={msg.id} className="p-3 rounded-lg border bg-card flex flex-col gap-2 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleViewMessage(msg)}>
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                                <Checkbox checked={!isRead} aria-label={isRead ? "Mensagem lida" : "Mensagem não lida"} className={cn("pointer-events-none mt-0.5 flex-shrink-0", { 'border-muted-foreground data-[state=checked]:bg-muted-foreground/30 data-[state=checked]:border-muted-foreground': !isRead, 'border-input data-[state=checked]:bg-transparent': isRead })} />
                                                <p className={cn("font-body text-sm text-foreground truncate", { 'font-bold': !isRead })}>{msg.title}</p>
                                            </div>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap pl-1 flex-shrink-0">{new Date(msg.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                                        </div>
                                        <p className={cn("text-sm text-muted-foreground font-body pl-8", { 'font-bold text-foreground': !isRead, 'font-normal': isRead })}>
                                            {msg.content.length > 80 ? `${msg.content.substring(0, 80)}...` : msg.content}
                                            {msg.content.length > 80 && <span className={cn("text-black ml-1 hover:underline", { 'font-semibold': !isRead, 'font-normal': isRead })} >Leia mais</span>}
                                        </p>
                                        <div className="flex justify-end mt-auto"><Badge variant="outline" className="font-body">{msg.sender}</Badge></div>
                                    </div>
                                )})}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-6">
                        <MessageSquare className="h-10 w-10 mb-4" />
                        <p className="text-sm text-muted-foreground font-body">
                            Por enquanto nenhuma mensagem nova, {user?.displayName?.split(' ')[0]}!
                        </p>
                    </div>
                )}
                </CardContent>
            </Card>
        </section>
      </div>

      <Dialog open={!!selectedMessage} onOpenChange={(isOpen) => !isOpen && setSelectedMessage(null)}>
        <DialogContent className="sm:max-w-xl">
          {selectedMessage && (
            <>
              <DialogHeader>
                <DialogTitle className="font-headline text-2xl">{selectedMessage.title}</DialogTitle>
                <DialogDescription className="text-left pt-2">De: {selectedMessage.sender}<br />Data: {new Date(selectedMessage.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</DialogDescription>
              </DialogHeader>
              <div className="py-4 text-sm text-foreground max-h-[60vh] overflow-y-auto">
                 {selectedMessage.mediaUrl && (
                  <div className="mb-4">
                    <Image src={selectedMessage.mediaUrl} alt="Mídia da mensagem" width={500} height={300} className="rounded-md object-cover w-full" />
                  </div>
                 )}
                 {selectedMessage.content.split('\\n').map((line, index) => (<p key={index} className="mb-2 last:mb-0">{line || '\u00A0'}</p>))}
                 {selectedMessage.link && (
                    <div className="mt-4">
                       <Button variant="outline" asChild>
                         <a href={selectedMessage.link} target="_blank" rel="noopener noreferrer">
                           <LinkIcon className="mr-2 h-4 w-4" />
                           Acessar Link
                         </a>
                       </Button>
                    </div>
                 )}
              </div>
              <DialogFooter className="justify-between">
                <Button variant="destructive" onClick={handleUserDeleteMessage} disabled={isDeleting}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Mover para lixeira
                </Button>
                <Button variant="secondary" onClick={() => setSelectedMessage(null)} className="hover:bg-muted">Fechar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedNews} onOpenChange={(isOpen) => !isOpen && setSelectedNews(null)}>
        <DialogContent className="max-w-2xl">
          {selectedNews && (
            <>
              <DialogHeader>
                <div className="relative w-full h-64 rounded-lg overflow-hidden mb-4 bg-black">
                    {selectedNews.videoUrl ? (
                         <video src={selectedNews.videoUrl} controls autoPlay className="w-full h-full object-contain" />
                    ) : (
                        <Image
                            src={selectedNews.imageUrl}
                            alt={selectedNews.title}
                            layout="fill"
                            objectFit="cover"
                        />
                    )}
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
                <div className="py-4 text-sm text-foreground">
                  {selectedNews.content && <p className="whitespace-pre-wrap">{selectedNews.content}</p>}
                  {selectedNews.link && (
                    <div className="mt-4">
                       <Button variant="outline" asChild>
                         <a href={selectedNews.link} target="_blank" rel="noopener noreferrer">
                           <LinkIcon className="mr-2 h-4 w-4" />
                           Acessar Link
                         </a>
                       </Button>
                    </div>
                 )}
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
