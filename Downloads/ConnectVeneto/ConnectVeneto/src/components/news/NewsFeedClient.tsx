"use client";

import React, { useState, useMemo } from 'react';
import type { NewsItemType } from '@/contexts/NewsContext';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { Search, CalendarDays, Link as LinkIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { getCollaboratorUserId, useCollaborators } from '@/contexts/CollaboratorsContext';
import { addDocumentToCollection } from '@/lib/firestore-service';
import { findCollaboratorByEmail } from '@/lib/email-utils';

interface NewsFeedClientProps {
  initialNewsItems: NewsItemType[];
}

export default function NewsFeedClient({ initialNewsItems }: NewsFeedClientProps) {
  const [selectedNews, setSelectedNews] = useState<NewsItemType | null>(null);

  const sortedNews = useMemo(() => {
    return initialNewsItems
      .filter((item) => item.status !== 'archived')
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [initialNewsItems]);

  const { user } = useAuth();
  const { collaborators } = useCollaborators();

  const logContentView = (item: NewsItemType) => {
    const currentUserCollab = findCollaboratorByEmail(collaborators, user?.email);
    if (!currentUserCollab) return;

    addDocumentToCollection('audit_logs', {
      eventType: 'content_view',
      userId: getCollaboratorUserId(currentUserCollab),
      userName: currentUserCollab.name,
      timestamp: new Date().toISOString(),
      details: {
        contentId: item.id,
        contentTitle: item.title,
        contentType: 'news',
      },
    }).catch(console.error);
  };

  const handleViewNews = (item: NewsItemType) => {
    setSelectedNews(item);
    logContentView(item);
  };

  return (
    <>
      {sortedNews.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedNews.map((item) => (
            <Card
              key={item.id}
              className="flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 cursor-pointer"
              onClick={() => handleViewNews(item)}
              onKeyDown={(e) => e.key === 'Enter' && handleViewNews(item)}
              tabIndex={0}
              aria-label={`Ver notícia: ${item.title}`}
            >
              <div className="relative w-full h-48 bg-black">
                {item.videoUrl ? (
                  <video
                    src={item.videoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                )}
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="font-headline text-lg leading-tight">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground font-body leading-relaxed">{item.snippet}</p>
              </CardContent>
              <CardFooter className="flex flex-col items-start text-xs text-muted-foreground border-t pt-4 gap-2">
                <div className="flex items-center gap-1 font-body">
                  <CalendarDays className="h-4 w-4" />
                  {new Date(item.date).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
                <Badge variant="outline" className="font-body text-foreground">
                  {item.category}
                </Badge>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-xl font-semibold text-muted-foreground font-headline">
            Nenhuma notícia encontrada.
          </p>
          <p className="text-muted-foreground font-body">Não há notícias disponíveis no momento.</p>
        </div>
      )}

      <Dialog open={!!selectedNews} onOpenChange={(isOpen) => !isOpen && setSelectedNews(null)}>
        <DialogContent className="max-w-2xl">
          {selectedNews && (
            <>
              <DialogHeader>
                <div className="relative w-full h-64 rounded-lg overflow-hidden mb-4 bg-black">
                  {selectedNews.videoUrl ? (
                    <video
                      src={selectedNews.videoUrl}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Image
                      src={selectedNews.imageUrl}
                      alt={selectedNews.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 672px"
                    />
                  )}
                </div>
                <DialogTitle className="font-headline text-2xl text-left">{selectedNews.title}</DialogTitle>
                <div className="text-left !mt-2">
                  <Badge variant="outline" className="font-body text-foreground">
                    {selectedNews.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-body ml-2">
                    {new Date(selectedNews.date).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
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
                  <Button type="button" variant="outline" className="hover:bg-muted">
                    Fechar
                  </Button>
                </DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
