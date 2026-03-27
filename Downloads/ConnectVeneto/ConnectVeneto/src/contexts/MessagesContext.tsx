
"use client";

import React, { createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import type { Collaborator } from '@/contexts/CollaboratorsContext';
import { getCollaboratorUserId } from '@/contexts/CollaboratorsContext';
import { useQuery, useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { addDocumentToCollection, updateDocumentInCollection, deleteDocumentFromCollection, WithId, listenToCollection, getCollection } from '@/lib/firestore-service';
import { useAuth } from './AuthContext';

export interface MessageType {
  id: string;
  title: string;
  content: string;
  sender: string;
  date: string; // ISO date string e.g. "2024-07-25"
  link?: string;
  mediaUrl?: string;
  recipientIds: string[]; // Array of collaborator ids
  readBy: string[]; // Array of collaborator ids who have read the message
  deletedBy: string[]; // Array of collaborator ids who have soft-deleted the message
}

interface MessagesContextType {
  messages: MessageType[];
  loading: boolean;
  addMessage: (message: Omit<MessageType, 'id' | 'readBy' | 'deletedBy' | 'date'>) => Promise<WithId<Omit<MessageType, 'id' | 'readBy' | 'deletedBy' | 'date'>>>;
  updateMessage: (message: MessageType) => Promise<void>;
  deleteMessageMutation: UseMutationResult<void, Error, string, unknown>;
  markMessageAsRead: (messageId: string, collaboratorId: string) => void;
  markMessageAsDeleted: (messageId: string, collaboratorId: string) => Promise<void>;
  getMessageRecipients: (message: MessageType, allCollaborators: Collaborator[]) => Collaborator[];
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);
const COLLECTION_NAME = 'messages';

export const MessagesProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: messages = [], isFetching } = useQuery<MessageType[]>({
    queryKey: [COLLECTION_NAME],
    queryFn: () => getCollection<MessageType>(COLLECTION_NAME),
    staleTime: Infinity,
    enabled: !!user,
    select: (data) => data.map(m => ({ ...m, readBy: m.readBy || [], deletedBy: m.deletedBy || [] })),
  });
  
  React.useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToCollection<MessageType>(
      COLLECTION_NAME,
      (newData) => {
        queryClient.setQueryData([COLLECTION_NAME], newData);
      },
      (error) => {
        console.error("Failed to listen to messages collection:", error);
      }
    );
    return () => unsubscribe();
  }, [queryClient, user]);

  const getMessageRecipients = useCallback((message: MessageType, allCollaborators: Collaborator[]): Collaborator[] => {
    if (message.recipientIds.includes('all')) {
      return allCollaborators;
    }
    return allCollaborators.filter(c => {
      const collaboratorId = getCollaboratorUserId(c);
      return collaboratorId ? message.recipientIds.includes(collaboratorId) : false;
    });
  }, []);

  const addMessageMutation = useMutation<WithId<Omit<MessageType, 'id' | 'readBy' | 'deletedBy' | 'date'>>, Error, Omit<MessageType, 'id' | 'readBy' | 'deletedBy' | 'date'>>({
    mutationFn: (messageData) => addDocumentToCollection(COLLECTION_NAME, {...messageData, date: new Date().toISOString(), readBy: [], deletedBy: []}),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const updateMessageMutation = useMutation<void, Error, MessageType>({
    mutationFn: (updatedMessage) => {
        const { id, ...data } = updatedMessage;
        return updateDocumentInCollection(COLLECTION_NAME, id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const deleteMessageMutation = useMutation<void, Error, string>({
    mutationFn: (id: string) => deleteDocumentFromCollection(COLLECTION_NAME, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const markMessageAsRead = useCallback((messageId: string, collaboratorId: string) => {
    const message = messages.find(m => m.id === messageId);
    if(message && !message.readBy.includes(collaboratorId)) {
        const updatedMessage = {
            ...message,
            readBy: [...message.readBy, collaboratorId]
        };
        updateMessageMutation.mutate(updatedMessage);
    }
  }, [messages, updateMessageMutation]);

  const markMessageAsDeleted = useCallback(async (messageId: string, collaboratorId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && !(message.deletedBy || []).includes(collaboratorId)) {
        const updatedMessage = {
            ...message,
            deletedBy: [...(message.deletedBy || []), collaboratorId],
        };
        // Use mutateAsync to await the operation if needed
        await updateMessageMutation.mutateAsync(updatedMessage);
    }
  }, [messages, updateMessageMutation]);
  
  const value = useMemo(() => ({
    messages,
    loading: isFetching,
    addMessage: (msg: Omit<MessageType, 'id' | 'readBy' | 'deletedBy' | 'date'>) => addMessageMutation.mutateAsync(msg),
    updateMessage: (msg: MessageType) => updateMessageMutation.mutateAsync(msg),
    deleteMessageMutation,
    markMessageAsRead,
    markMessageAsDeleted,
    getMessageRecipients
  }), [messages, isFetching, getMessageRecipients, addMessageMutation, updateMessageMutation, deleteMessageMutation, markMessageAsRead, markMessageAsDeleted]);

  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  );
};

export const useMessages = (): MessagesContextType => {
  const context = useContext(MessagesContext);
  if (context === undefined) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
};
