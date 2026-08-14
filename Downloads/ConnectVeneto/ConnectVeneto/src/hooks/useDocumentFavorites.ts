"use client";

import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDocument, setDocumentInCollection } from '@/lib/firestore-service';
import { useAuth } from '@/contexts/AuthContext';
import {
  DOCUMENT_FAVORITES_COLLECTION,
  favoriteKey,
  type DocumentFavorites,
  type DocumentSegment,
} from '@/config/biblioteca-comercial';

/**
 * Favoritos da biblioteca de documentos, válidos para as duas segmentações
 * (internos e comerciais). Guardados em `documentFavorites/{uid}` — um documento por
 * usuário, que as rules liberam apenas para o próprio dono.
 *
 * A escrita é direta no Firestore (não passa por API route): o dado é do usuário e a
 * rule consegue autorizar sozinha, porque o id do documento é o próprio `auth.uid`.
 */
export function useDocumentFavorites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.uid ?? null;

  const queryKey = useMemo(() => [DOCUMENT_FAVORITES_COLLECTION, uid], [uid]);

  const { data: favoriteIds = [] } = useQuery<string[]>({
    queryKey,
    queryFn: async () => {
      if (!uid) return [];
      const stored = await getDocument<DocumentFavorites>(DOCUMENT_FAVORITES_COLLECTION, uid);
      return Array.isArray(stored?.favoriteIds) ? stored.favoriteIds : [];
    },
    staleTime: Infinity,
    enabled: !!uid,
  });

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const saveMutation = useMutation<void, Error, string[], { previous: string[] }>({
    mutationFn: async (nextIds) => {
      if (!uid) throw new Error('Sessão expirada. Entre novamente para favoritar.');
      await setDocumentInCollection<DocumentFavorites>(DOCUMENT_FAVORITES_COLLECTION, uid, {
        favoriteIds: nextIds,
        updatedAt: new Date().toISOString(),
      });
    },
    // A estrela responde na hora; se a gravação falhar, voltamos ao estado anterior.
    onMutate: (nextIds) => {
      const previous = queryClient.getQueryData<string[]>(queryKey) ?? [];
      queryClient.setQueryData(queryKey, nextIds);
      return { previous };
    },
    onError: (_error, _nextIds, context) => {
      if (context) queryClient.setQueryData(queryKey, context.previous);
    },
  });

  const isFavorite = useCallback(
    (segment: DocumentSegment, documentId: string) => favoriteSet.has(favoriteKey(segment, documentId)),
    [favoriteSet]
  );

  const toggleFavorite = useCallback(
    (segment: DocumentSegment, documentId: string) => {
      if (!uid) return Promise.resolve();
      const key = favoriteKey(segment, documentId);
      // Lê do cache (não do render) para não perder toggles rápidos em sequência.
      const current = queryClient.getQueryData<string[]>(queryKey) ?? [];
      const next = current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key];
      return saveMutation.mutateAsync(next);
    },
    [uid, queryClient, queryKey, saveMutation]
  );

  return {
    favoriteIds,
    isFavorite,
    toggleFavorite,
    hasFavorites: favoriteIds.length > 0,
  };
}
