"use client";

import React, { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { useQuery, useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { listenToCollection, getCollection } from '@/lib/firestore-service';
import { getFirebaseApp } from '@/lib/firebase';
import { NEWS_COLLECTION } from '@/config/news-media';
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
  /** Preenchido quando a imagem veio de upload — usado para apagar o arquivo junto. */
  imageStoragePath?: string;
  videoUrl?: string;
  /** Preenchido quando o vídeo veio de upload. */
  videoStoragePath?: string;
  isHighlight: boolean;
  highlightType?: 'large' | 'small';
  link?: string;
  order: number;
  status: NewsStatus;
}

export type NewsItemDraft = Omit<NewsItemType, 'id' | 'status' | 'order' | 'isHighlight'> &
  Partial<Pick<NewsItemType, 'isHighlight' | 'order'>>;

interface NewsContextType {
  newsItems: NewsItemType[];
  loading: boolean;
  addNewsItem: (item: NewsItemDraft) => Promise<{ id: string }>;
  updateNewsItem: (item: Partial<NewsItemType> & { id: string }) => Promise<void>;
  updateNewsStatus: (id: string, status: NewsStatus) => Promise<void>;
  archiveNewsItem: (id: string) => Promise<void>;
  deleteNewsItemMutation: UseMutationResult<void, Error, string, unknown>;
  toggleNewsHighlight: (id: string) => void;
  updateHighlightType: (id: string, type: 'large' | 'small') => void;
}

const NewsContext = createContext<NewsContextType | undefined>(undefined);
const COLLECTION_NAME = NEWS_COLLECTION;
const API_PATH = '/api/admin/news';

/**
 * Toda escrita passa pela API route, que valida `canManageContent` com o Admin SDK.
 *
 * As rules do Firestore só liberam leitura de `newsItems`: a permissão mora no
 * documento do colaborador, que elas não conseguem consultar por e-mail (os IDs
 * são auto-gerados). Escrever direto daqui dava `permission-denied` para quem não
 * é super admin — mesmo padrão já usado na Biblioteca Comercial e no Mix de Serviços.
 */
const authorizedRequest = async <T,>(
  url: string,
  init: { method: string; body?: unknown }
): Promise<T> => {
  const currentUser = getAuth(getFirebaseApp()).currentUser;
  if (!currentUser) throw new Error('Sessão expirada. Entre novamente para continuar.');

  const token = await currentUser.getIdToken();
  const response = await fetch(url, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });

  const payload = (await response.json().catch(() => null)) as
    | ({ error?: string } & Record<string, unknown>)
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Não foi possível concluir a operação.');
  }

  return (payload ?? {}) as T;
};

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

  const addNewsItemMutation = useMutation<{ id: string }, Error, NewsItemDraft>({
    // `status` e `order` são definidos no servidor — o client não tem a lista completa.
    mutationFn: (itemData) =>
      authorizedRequest<{ id: string }>(API_PATH, { method: 'POST', body: itemData }),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const updateNewsItemMutation = useMutation<void, Error, Partial<NewsItemType> & { id: string }>({
    mutationFn: async (updatedItem) => {
        const { id, ...data } = updatedItem;
        await authorizedRequest(`${API_PATH}?id=${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: data,
        });
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
    mutationFn: async (id: string) => {
      await authorizedRequest(`${API_PATH}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
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
    addNewsItem: (item: NewsItemDraft) => addNewsItemMutation.mutateAsync(item),
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
