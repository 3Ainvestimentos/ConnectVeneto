"use client";

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '../ui/button';
import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from '@/lib/firebase';

interface FeedItem {
  title: string;
  link: string;
  contentSnippet?: string;
  isoDate?: string;
  sourceCategory?: string;
}

interface FeedResponse {
  title?: string;
  items: FeedItem[];
}


const feedUrls = [
  'https://www.infomoney.com.br/mercados/rss',
  'https://www.infomoney.com.br/economia/rss',
  'https://www.infomoney.com.br/business/rss',
  'https://www.infomoney.com.br/mundo/rss',
];

const fetchFeeds = async (urls: string[]): Promise<FeedResponse> => {
  const auth = getAuth(getFirebaseApp());
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) {
    throw new Error('Nao foi possivel validar autenticacao para consultar o feed RSS.');
  }

  const response = await fetch(`/api/rss?urls=${encodeURIComponent(urls.join(','))}`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Não foi possível carregar os feeds de notícias.');
  }
  return response.json();
};

export default function RssFeed() {
  const { theme } = useTheme();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(3);

  useEffect(() => {
    const getItemsPerPage = () => {
        if (window.innerWidth >= 1024) return 4;
        if (window.innerWidth >= 768) return 2;
        return 1; 
    }

    const handleResize = () => {
        setItemsPerPage(getItemsPerPage());
        setCurrentPage(1); // Reset page on resize
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial value

    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const { data: feedData, isLoading, isError, dataUpdatedAt } = useQuery<FeedResponse, Error>({
    queryKey: ['rssFeeds', feedUrls],
    queryFn: () => fetchFeeds(feedUrls),
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchInterval: 1000 * 60 * 60, // 1 hour
    refetchOnWindowFocus: false,
  });

  const items = feedData?.items || [];
  const lastUpdatedTime = dataUpdatedAt ? format(new Date(dataUpdatedAt), 'HH:mm') : null;

  const logoUrl = theme === 'dark'
    ? 'https://firebasestorage.googleapis.com/v0/b/a-riva-hub.firebasestorage.app/o/Imagens%20institucionais%20(logos%20e%20etc)%2Finfomoney-logo%20branca.png?alt=media&token=4cc683ae-8d98-4ba8-bfa2-e965c8ae478f'
    : 'https://firebasestorage.googleapis.com/v0/b/a-riva-hub.firebasestorage.app/o/Imagens%20institucionais%20(logos%20e%20etc)%2Finfomoney-logo.png?alt=media&token=f94a25f3-116e-4b11-82db-5e65ecec3c6c';

  const totalPages = items ? Math.ceil(items.length / itemsPerPage) : 0;
  const paginatedItems = items ? items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : [];

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };


  const renderSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(itemsPerPage)].map((_, i) => (
        <Card key={i} className="flex flex-col">
          <CardHeader>
            <Skeleton className="h-5 w-4/5" />
          </CardHeader>
          <CardContent className="flex-grow">
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-4 w-1/2" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <Image src={logoUrl} alt="InfoMoney Logo" width={150} height={40} />
        <CardDescription>
            Feed de Notícias Externo
            {lastUpdatedTime && ` (atualizado às ${lastUpdatedTime})`}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-hidden">
        {isLoading && renderSkeleton()}
        {isError && <p className="text-center text-destructive">Erro ao carregar notícias do feed.</p>}
        {!isLoading && !isError && paginatedItems && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {paginatedItems.map((item, index) => (
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="block h-full group" key={index}>
                <Card className="h-full flex flex-col w-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle className="font-headline text-base leading-tight group-hover:underline break-words">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-4 break-words">{item.contentSnippet}</p>
                  </CardContent>
                  <CardFooter className="flex justify-between items-center text-xs text-secondary-foreground bg-secondary border-t pt-3 mt-auto">
                    <span>{item.sourceCategory || 'InfoMoney'}</span>
                    <span>{item.isoDate ? format(new Date(item.isoDate), "dd MMM, yyyy", { locale: ptBR }) : ''}</span>
                  </CardFooter>
                </Card>
              </a>
            ))}
          </div>
        )}
      </CardContent>
       <CardFooter className="flex justify-center items-center pt-4 border-t">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevPage} disabled={currentPage === 1} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
             <span className="sr-only">Anterior</span>
          </Button>
          <span className="text-xs text-muted-foreground font-mono">
            {currentPage} / {totalPages}
          </span>
          <Button variant="outline" size="icon" onClick={handleNextPage} disabled={currentPage === totalPages} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Próxima</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
