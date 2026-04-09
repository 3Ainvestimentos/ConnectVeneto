"use client";

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useNews, type NewsItemType } from '@/contexts/NewsContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCollaboratorUserId, useCollaborators } from '@/contexts/CollaboratorsContext';
import { findCollaboratorByEmail } from '@/lib/email-utils';
import { addDocumentToCollection } from '@/lib/firestore-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function NewsHighlights() {
  const [selectedNews, setSelectedNews] = useState<NewsItemType | null>(null);
  const { newsItems } = useNews();
  const { user } = useAuth();
  const { collaborators } = useCollaborators();

  const currentUserCollab = useMemo(() => {
    if (!user || !collaborators) return null;
    return findCollaboratorByEmail(collaborators, user.email) || null;
  }, [user, collaborators]);

  const activeHighlights = useMemo(() => {
    const filtered = newsItems.filter(item => item.isHighlight && item.status === 'published');
    return [...filtered].sort((a, b) => (b.order || 0) - (a.order || 0)).slice(0, 3);
  }, [newsItems]);

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

  if (activeHighlights.length === 0) return null;

  const getGridClass = () => {
    const count = Math.min(activeHighlights.length, 3); // Agora permite até 3
    
    switch (count) {
      case 1:
        return "grid-cols-1";
      case 2:
        // Lógica de 2 cards (uma pode ser grande e pegar 2 colunas de 3)
        const highlights2 = activeHighlights.sort((a, b) => (b.order || 0) - (a.order || 0)).slice(0, 2);
        const hasLarge = highlights2.some(h => h.highlightType === 'large');
        return hasLarge ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2";
      case 3:
      default:
        // Grid original para 3 cards (empilhados) - removido md:grid-rows-2 que estava quebrando o layout
        return "grid-cols-1 md:grid-cols-2";
    }
  };

  const HighlightCard = ({ item, className = "" }: { item: NewsItemType, className?: string }) => (
    <div
      className={cn("relative rounded-xl overflow-hidden group block cursor-pointer", className)}
      onClick={() => handleViewNews(item)}
      onKeyDown={(e) => e.key === 'Enter' && handleViewNews(item)}
      tabIndex={0}
      role="button"
      aria-label={`Ver notícia: ${item.title}`}
    >
      <Image src={item.imageUrl} alt={item.title} fill style={{ objectFit: 'cover' }} className="transition-transform duration-300 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-5 pb-6 flex flex-col justify-end">
        <h3 className="text-xl font-headline font-bold text-white tracking-tight">{item.title}</h3>
        <p className="text-sm text-gray-200 font-body font-light line-clamp-2">{item.snippet}</p>
      </div>
    </div>
  );

  const renderHighlights = () => {
    // Permite 3 novamente
    const highlights = [...activeHighlights].sort((a, b) => (b.order || 0) - (a.order || 0)).slice(0, 3);
    
    switch (highlights.length) {
      case 1:
        return <HighlightCard item={highlights[0]} className="h-[300px] md:h-[500px] md:min-h-[500px] w-full" />;
      case 2:
        const largeIndex2 = highlights.findIndex(h => h.highlightType === 'large');
        if (largeIndex2 === -1) {
          return (
            <>
              <HighlightCard item={highlights[0]} className="h-[300px] md:h-[500px] md:min-h-[500px] w-full" />
              <HighlightCard item={highlights[1]} className="h-[300px] md:h-[500px] md:min-h-[500px] w-full" />
            </>
          );
        }

        const mainCard2 = highlights[largeIndex2];
        const sideCard2 = highlights[largeIndex2 === 0 ? 1 : 0];

        return (
          <>
            {largeIndex2 === 0 ? (
              <>
                <HighlightCard item={mainCard2} className="h-[300px] md:h-[500px] md:min-h-[500px] md:col-span-2 w-full" />
                <HighlightCard item={sideCard2} className="h-[300px] md:h-[500px] md:min-h-[500px] w-full" />
              </>
            ) : (
              <>
                <HighlightCard item={sideCard2} className="h-[300px] md:h-[500px] md:min-h-[500px] w-full" />
                <HighlightCard item={mainCard2} className="h-[300px] md:h-[500px] md:min-h-[500px] md:col-span-2 w-full" />
              </>
            )}
          </>
        );
      case 3:
      default:
        // Lógica da Bento Box original
        const largeIndex3 = highlights.findIndex(h => h.highlightType === 'large');
        const mainIdx = largeIndex3 !== -1 ? largeIndex3 : 1; 
        
        const mainCard3 = highlights[mainIdx];
        const sideCards3 = highlights.filter((_, idx) => idx !== mainIdx);

        if (mainIdx === 0) {
          return (
            <>
              <HighlightCard item={mainCard3} className="h-[250px] md:h-[500px] w-full" />
              <div className="flex flex-col gap-3">
                <HighlightCard item={sideCards3[0]} className="h-[200px] md:h-[244px] w-full" />
                <HighlightCard item={sideCards3[1]} className="h-[200px] md:h-[244px] w-full" />
              </div>
            </>
          );
        }

        return (
          <>
            <div className="flex flex-col gap-3">
              <HighlightCard item={sideCards3[0]} className="h-[200px] md:h-[244px] w-full" />
              <HighlightCard item={sideCards3[1]} className="h-[200px] md:h-[244px] w-full" />
            </div>
            <HighlightCard item={mainCard3} className="h-[250px] md:h-[500px] w-full" />
          </>
        );
    }
  };

  return (
    <>
      <div className="mb-8">
        <div className={cn("grid gap-3", getGridClass())}>
          {renderHighlights()}
        </div>
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
                    fill
                    style={{ objectFit: 'cover' }}
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