"use client";

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  addDocumentToCollection,
  updateDocumentInCollection,
  deleteDocumentFromCollection,
  listenToCollection,
  getCollection,
  WithId,
} from '@/lib/firestore-service';

export interface UseFirestoreCollectionOptions<T> {
  /** Transform applied to the data after fetching and after each realtime update. */
  select?: (data: T[]) => T[];
  /** How long (ms) before the query is considered stale. Defaults to Infinity (cache-first). */
  staleTime?: number;
}

export interface UseFirestoreCollectionResult<T> {
  items: T[];
  loading: boolean;
  addItem: (data: Omit<T, 'id'>) => Promise<WithId<Omit<T, 'id'>>>;
  updateItem: (data: Partial<T> & { id: string }) => Promise<void>;
  deleteItemMutation: UseMutationResult<void, Error, string, unknown>;
}

/**
 * Encapsulates the standard Firestore collection pattern:
 * initial fetch (React Query) + realtime listener (onSnapshot) + CRUD mutations.
 *
 * Usage:
 *   const { items, loading, addItem, updateItem, deleteItemMutation } =
 *     useFirestoreCollection<MyType>('myCollection', { select: sortFn });
 */
export function useFirestoreCollection<T extends { id: string }>(
  collectionName: string,
  options?: UseFirestoreCollectionOptions<T>
): UseFirestoreCollectionResult<T> {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEnabled = !!user;

  const { data: items = [], isFetching, error } = useQuery<T[]>({
    queryKey: [collectionName],
    queryFn: () => getCollection<T>(collectionName),
    staleTime: options?.staleTime ?? Infinity,
    enabled: isEnabled,
    select: options?.select,
  });

  if (error) {
    console.error(`[useFirestoreCollection] error in ${collectionName}:`, error);
  }

  useEffect(() => {
    if (!isEnabled) return;
    const unsubscribe = listenToCollection<T>(
      collectionName,
      (newData) => {
        // React Query's `select` option is applied automatically when reading the data.
        // We must store the RAW data in the cache, NOT the processed data, 
        // otherwise `select` runs twice (select(select(newData))) and may break.
        queryClient.setQueryData([collectionName], newData);
      },
      (error) => {
        console.error(`[${collectionName}] realtime listener error:`, error);
      }
    );
    return () => unsubscribe();
  }, [collectionName, queryClient, isEnabled]);

  const addItemMutation = useMutation<WithId<Omit<T, 'id'>>, Error, Omit<T, 'id'>>({
    mutationFn: (data) => addDocumentToCollection(collectionName, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [collectionName] }),
  });

  const updateItemMutation = useMutation<void, Error, Partial<T> & { id: string }>({
    mutationFn: ({ id, ...data }) =>
      updateDocumentInCollection(collectionName, id, data as Partial<Omit<T, 'id'>>),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [collectionName] }),
  });

  const deleteItemMutation = useMutation<void, Error, string>({
    mutationFn: (id) => deleteDocumentFromCollection(collectionName, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [collectionName] }),
  });

  return {
    items,
    loading: isFetching,
    addItem: (data) => addItemMutation.mutateAsync(data),
    updateItem: (data) => updateItemMutation.mutateAsync(data),
    deleteItemMutation,
  };
}
