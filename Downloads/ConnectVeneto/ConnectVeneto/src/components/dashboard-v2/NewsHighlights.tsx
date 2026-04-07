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

  if (activeHighlights.length === 0) return null;

  const getGridClass = () => {
    switch (activeHighlights.length) {
      case 1:
        return "grid-cols-1";
      case 2:
        return "grid-cols-1 md:grid-cols-2";
      case 3:
        return "grid-cols-1 md:grid-cols-2 md:grid-rows-2";
      default:
        return "grid-cols-1 md:grid-cols-2 md:grid-rows-2";
    }
  };

  const HighlightCard = ({ item, className = "" }: { item: NewsItemType, className?: string }) => (
    <div
      className={cn("relative rounded-lg overflow-hidden group block cursor-pointer", className)}
      onClick={() => handleViewNews(item)}
      onKeyDown={(e) => e.key === 'Enter' && handleViewNews(item)}
      tabIndex={0}
      role="button"
      aria-label={`Ver notícia: ${item.title}`}
    >
      <Image src={item.imageUrl} alt={item.title} fill style={{ objectFit: 'cover' }} className="transition-transform duration-300 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-4 flex flex-col justify-end">
        <h3 className="text-xl font-headline font-bold text-white">{item.title}</h3>
        <p className="text-sm text-gray-200 font-body">{item.snippet}</p>
      </div>
    </div>
  );

  const renderHighlights = () => {
    const highlights = activeHighlights.slice(0, 3); // max 3
    switch (highlights.length) {
      case 1:
        return <HighlightCard item={highlights[0]} className="min-h-[300px] md:min-h-[450px]" />;
      case 2:
        return (
          <>
            <HighlightCard item={highlights[0]} className="min-h-[220px] md:min-h-[450px]" />
            <HighlightCard item={highlights[1]} className="min-h-[220px] md:min-h-[450px]" />
          </>
        );
      case 3:
      default:
        return (
          <>
            <HighlightCard item={highlights[0]} className="min-h-[220px] md:min-h-[450px]" />
            <HighlightCard item={highlights[1]} className="md:row-span-2 min-h-[220px] md:min-h-[450px]" />
            <HighlightCard item={highlights[2]} className="min-h-[220px] md:min-h-[450px]" />
          </>
        );
    }
  };

  return (
    <>
      <div className="mb-6">
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