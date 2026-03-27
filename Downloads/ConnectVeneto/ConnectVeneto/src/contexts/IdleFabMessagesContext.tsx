
"use client";

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addDocumentToCollection, updateDocumentInCollection, deleteDocumentFromCollection, WithId, listenToCollection, getCollection } from '@/lib/firestore-service';
import * as z from 'zod';
import { useAuth } from './AuthContext';

export const idleFabMessageSchema = z.object({
  text: z.string().min(10, "A mensagem deve ter pelo menos 10 caracteres."),
  order: z.number().default(0),
});

export type IdleFabMessageType = WithId<z.infer<typeof idleFabMessageSchema>>;

interface IdleFabMessagesContextType {
  idleMessages: IdleFabMessageType[];
  loading: boolean;
  addIdleMessage: (message: Omit<IdleFabMessageType, 'id'>) => Promise<IdleFabMessageType>;
  updateIdleMessage: (message: Partial<IdleFabMessageType> & { id: string }) => Promise<void>;
  deleteIdleMessage: (id: string) => Promise<void>;
}

const IdleFabMessagesContext = createContext<IdleFabMessagesContextType | undefined>(undefined);
const COLLECTION_NAME = 'idleFabMessages';

export const IdleFabMessagesProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: idleMessages = [], isFetching } = useQuery<IdleFabMessageType[]>({
    queryKey: [COLLECTION_NAME],
    queryFn: () => getCollection<IdleFabMessageType>(COLLECTION_NAME),
    staleTime: Infinity,
    enabled: !!user,
    select: (data) => data.sort((a, b) => (a.order || 0) - (b.order || 0)),
  });

  React.useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToCollection<IdleFabMessageType>(
      COLLECTION_NAME,
      (newData) => {
        const sortedData = newData.sort((a, b) => (a.order || 0) - (b.order || 0));
        queryClient.setQueryData([COLLECTION_NAME], sortedData);
      },
      (error) => {
        console.error(`Failed to listen to ${COLLECTION_NAME} collection:`, error);
      }
    );
    return () => unsubscribe();
  }, [queryClient, user]);

  const addMutation = useMutation<WithId<Omit<IdleFabMessageType, 'id'>>, Error, Omit<IdleFabMessageType, 'id'>>({
    mutationFn: (messageData) => addDocumentToCollection(COLLECTION_NAME, messageData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const updateMutation = useMutation<void, Error, Partial<IdleFabMessageType> & { id: string }>({
    mutationFn: (updatedMessage) => {
      const { id, ...data } = updatedMessage;
      return updateDocumentInCollection(COLLECTION_NAME, id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) => deleteDocumentFromCollection(COLLECTION_NAME, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const value = useMemo(() => ({
    idleMessages,
    loading: isFetching,
    addIdleMessage: (message: Omit<IdleFabMessageType, 'id'>) => addMutation.mutateAsync(message) as Promise<IdleFabMessageType>,
    updateIdleMessage: (message: Partial<IdleFabMessageType> & { id: string }) => updateMutation.mutateAsync(message),
    deleteIdleMessage: (id: string) => deleteMutation.mutateAsync(id),
  }), [idleMessages, isFetching, addMutation, updateMutation, deleteMutation]);

  return (
    <IdleFabMessagesContext.Provider value={value}>
      {children}
    </IdleFabMessagesContext.Provider>
  );
};

export const useIdleFabMessages = (): IdleFabMessagesContextType => {
  const context = useContext(IdleFabMessagesContext);
  if (context === undefined) {
    throw new Error('useIdleFabMessages must be used within a IdleFabMessagesProvider');
  }
  return context;
};
