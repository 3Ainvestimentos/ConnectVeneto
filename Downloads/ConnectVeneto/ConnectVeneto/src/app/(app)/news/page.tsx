
"use client";

import { PageHeader } from '@/components/layout/PageHeader';
import NewsFeedClient from '@/components/news/NewsFeedClient';
import { useNews } from '@/contexts/NewsContext';
import type { NewsItemType } from '@/contexts/NewsContext';
import { useMemo } from 'react';

export default function NewsPage() {
  const { newsItems } = useNews();
  
  const publishedNews = useMemo(() => {
    return newsItems.filter(item => item.status === 'published');
  }, [newsItems]);

  return (
    <div className="space-y-6 p-6 md:p-8">
      <PageHeader 
        title="Feed de Notícias" 
        description="Mantenha-se atualizado com as últimas notícias e comunicados."
      />
      <NewsFeedClient initialNewsItems={publishedNews} />
    </div>
  );
}

export type { NewsItemType };
