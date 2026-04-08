
"use client";

import React, { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { addDocumentToCollection, updateDocumentInCollection, deleteDocumentFromCollection, WithId, listenToCollection, getCollection } from '@/lib/firestore-service';
import { useAuth } from './AuthContext';

export type NewsStatus = 'draft' | 'approved' | 'published' | 'archived';

export interface NewsItemType {
  id: string;
  title: string;
  snippet: string;
  content: string;
  category: string;
  date: string; // ISO string
  imageUrl: string;
  videoUrl?: string;
  isHighlight: boolean;
  highlightType?: 'large' | 'small';
  link?: string;
  order: number;
  status: NewsStatus;
}

interface NewsContextType {
  newsItems: NewsItemType[];
  loading: boolean;
  addNewsItem: (item: Omit<NewsItemType, 'id' | 'status'>) => Promise<WithId<Omit<NewsItemType, 'id' | 'status'>>>;
  updateNewsItem: (item: Partial<NewsItemType> & { id: string }) => Promise<void>;
  updateNewsStatus: (id: string, status: NewsStatus) => Promise<void>;
  archiveNewsItem: (id: string) => Promise<void>;
  deleteNewsItemMutation: UseMutationResult<void, Error, string, unknown>;
  toggleNewsHighlight: (id: string) => void;
  updateHighlightType: (id: string, type: 'large' | 'small') => void;
}

const NewsContext = createContext<NewsContextType | undefined>(undefined);
const COLLECTION_NAME = 'newsItems';

export const NewsProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: newsItems = [], isFetching } = useQuery<NewsItemType[]>({
    queryKey: [COLLECTION_NAME],
    queryFn: () => getCollection<NewsItemType>(COLLECTION_NAME),
    staleTime: Infinity,
    enabled: !!user,
    select: (data) => data.map(item => ({
      ...item,
      order: item.order ?? 0,
      status: item.status || 'published', // Fallback for old items
    })).sort((a, b) => a.order - b.order),
  });

  React.useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToCollection<NewsItemType>(
      COLLECTION_NAME,
      (newData) => {
        const processedData = newData.map(item => ({
          ...item,
          order: item.order ?? 0,
          status: item.status || 'published',
        })).sort((a, b) => a.order - b.order);
        queryClient.setQueryData([COLLECTION_NAME], processedData);
      },
      (error) => {
        console.error("Failed to listen to news collection:", error);
      }
    );
    return () => unsubscribe();
  }, [queryClient, user]);

  const addNewsItemMutation = useMutation<WithId<Omit<NewsItemType, 'id' | 'status'>>, Error, Omit<NewsItemType, 'id' | 'status'>>({
    mutationFn: (itemData) => {
        const currentMaxOrder = newsItems.reduce((max, item) => Math.max(max, item.order || 0), 0);
        const dataWithDefaults = { 
            ...itemData, 
            status: 'draft' as NewsStatus,
            order: currentMaxOrder + 1 
        };
        return addDocumentToCollection(COLLECTION_NAME, dataWithDefaults);
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const updateNewsItemMutation = useMutation<void, Error, Partial<NewsItemType> & { id: string }>({
    mutationFn: (updatedItem) => {
        const { id, ...data } = updatedItem;
        return updateDocumentInCollection(COLLECTION_NAME, id, data);
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
    onError: (error) => {
        toast({
            title: "Erro ao Salvar",
            description: `Não foi possível salvar a notícia. Detalhes: ${error.message}`,
            variant: "destructive",
        });
    }
  });

  const deleteNewsItemMutation = useMutation<void, Error, string>({
    mutationFn: (id: string) => deleteDocumentFromCollection(COLLECTION_NAME, id),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const updateNewsStatus = useCallback(async (id: string, status: NewsStatus) => {
    await updateNewsItemMutation.mutateAsync({ id, status });
  }, [updateNewsItemMutation]);

  const archiveNewsItem = useCallback(async (id: string) => {
    await updateNewsItemMutation.mutateAsync({ id, status: 'archived' });
  }, [updateNewsItemMutation]);


  const toggleNewsHighlight = useCallback((id: string) => {
    const targetNews = newsItems.find(n => n.id === id);
    if (!targetNews) return;

    if (targetNews.status !== 'published') {
      toast({
        title: "Ação não permitida",
        description: "Apenas notícias publicadas podem ser colocadas em destaque.",
        variant: "destructive"
      });
      return;
    }

    // A trava de 3 itens foi removida para você não ficar bloqueado por notícias "fantasmas"
    // ou por bugs do Firebase. O componente da tela inicial (NewsHighlights.tsx)
    // já se encarrega de fatiar apenas as 3 mais relevantes e exibir, não havendo quebra de layout.
    
    updateNewsItemMutation.mutate({ id, isHighlight: !targetNews.isHighlight });
  }, [newsItems, updateNewsItemMutation]);

  const updateHighlightType = useCallback((id: string, type: 'large' | 'small') => {
    const targetNews = newsItems.find(n => n.id === id);
    if (!targetNews) return;

    // A trava que impedia a mudança foi removida para contornar lixo no banco de dados.
    // O sistema visual já trata qual será grande se houverem várias.
    
    updateNewsItemMutation.mutate({ id, highlightType: type });
  }, [newsItems, updateNewsItemMutation]);


  const value = useMemo(() => ({
    newsItems,
    loading: isFetching,
    addNewsItem: (item: Omit<NewsItemType, 'id' | 'status'>) => addNewsItemMutation.mutateAsync(item),
    updateNewsItem: (item: Partial<NewsItemType> & { id: string }) => updateNewsItemMutation.mutateAsync(item),
    deleteNewsItemMutation,
    toggleNewsHighlight,
    updateHighlightType,
    updateNewsStatus,
    archiveNewsItem,
  }), [newsItems, isFetching, addNewsItemMutation, updateNewsItemMutation, deleteNewsItemMutation, toggleNewsHighlight, updateHighlightType, updateNewsStatus, archiveNewsItem]);

  return (
    <NewsContext.Provider value={value}>
      {children}
    </NewsContext.Provider>
  );
};

export const useNews = (): NewsContextType => {
  const context = useContext(NewsContext);
  if (context === undefined) {
    throw new Error('useNews must be used within a NewsProvider');
  }
  return context;
};
