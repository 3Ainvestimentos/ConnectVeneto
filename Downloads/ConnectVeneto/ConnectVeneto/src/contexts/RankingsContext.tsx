
"use client";

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { addDocumentToCollection, updateDocumentInCollection, deleteDocumentFromCollection, WithId, listenToCollection, getCollection } from '@/lib/firestore-service';
import * as z from 'zod';
import { useAuth } from './AuthContext';

export const rankingSchema = z.object({
  name: z.string().min(1, "O nome da aba é obrigatório."),
  pdfUrl: z.string().min(1, "A URL do PDF é obrigatória."),
  order: z.number().default(0),
  recipientIds: z.array(z.string()).min(1, "Selecione ao menos um destinatário.").default(['all']),
});

export type RankingType = WithId<z.infer<typeof rankingSchema>>;

interface RankingsContextType {
  rankings: RankingType[];
  loading: boolean;
  addRanking: (ranking: Omit<RankingType, 'id'>) => Promise<RankingType>;
  updateRanking: (ranking: Partial<RankingType> & { id: string }) => Promise<void>;
  deleteRankingMutation: UseMutationResult<void, Error, string, unknown>;
}

const RankingsContext = createContext<RankingsContextType | undefined>(undefined);
const COLLECTION_NAME = 'rankings';

export const RankingsProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: rankings = [], isFetching } = useQuery<RankingType[]>({
    queryKey: [COLLECTION_NAME],
    queryFn: () => getCollection<RankingType>(COLLECTION_NAME),
    staleTime: Infinity,
    enabled: !!user,
    select: (data) => data
      .map(r => ({ ...r, recipientIds: r.recipientIds || ['all'] }))
      .sort((a, b) => (a.order || 0) - (b.order || 0)),
  });

  React.useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToCollection<RankingType>(
      COLLECTION_NAME,
      (newData) => {
        const sortedData = newData
          .map(r => ({ ...r, recipientIds: r.recipientIds || ['all'] }))
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        queryClient.setQueryData([COLLECTION_NAME], sortedData);
      },
      (error) => {
        console.error("Failed to listen to rankings collection:", error);
      }
    );
    return () => unsubscribe();
  }, [queryClient, user]);

  const addRankingMutation = useMutation<WithId<Omit<RankingType, 'id'>>, Error, Omit<RankingType, 'id'>>({
    mutationFn: (rankingData) => addDocumentToCollection(COLLECTION_NAME, rankingData),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const updateRankingMutation = useMutation<void, Error, Partial<RankingType> & { id: string }>({
    mutationFn: (updatedRanking) => {
      const { id, ...data } = updatedRanking;
      return updateDocumentInCollection(COLLECTION_NAME, id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const deleteRankingMutation = useMutation<void, Error, string>({
    mutationFn: (id) => deleteDocumentFromCollection(COLLECTION_NAME, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const value = useMemo(() => ({
    rankings,
    loading: isFetching,
    addRanking: (ranking: Omit<RankingType, 'id'>) => addRankingMutation.mutateAsync(ranking) as Promise<RankingType>,
    updateRanking: (ranking: Partial<RankingType> & { id: string }) => updateRankingMutation.mutateAsync(ranking),
    deleteRankingMutation,
  }), [rankings, isFetching, addRankingMutation, updateRankingMutation, deleteRankingMutation]);

  return (
    <RankingsContext.Provider value={value}>
      {children}
    </RankingsContext.Provider>
  );
};

export const useRankings = (): RankingsContextType => {
  const context = useContext(RankingsContext);
  if (context === undefined) {
    throw new Error('useRankings must be used within a RankingsProvider');
  }
  return context;
};
