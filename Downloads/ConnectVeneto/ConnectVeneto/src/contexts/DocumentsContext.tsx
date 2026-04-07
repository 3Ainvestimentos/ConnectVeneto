
"use client";

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { addDocumentToCollection, updateDocumentInCollection, deleteDocumentFromCollection, WithId, listenToCollection, getCollection } from '@/lib/firestore-service';
import { useAuth } from './AuthContext';

export interface DocumentType {
  id: string;
  name: string;
  category: string;
  type: string;
  size: string;
  lastModified: string;
  downloadUrl: string;
  /** Só em linhas estáticas (código); não persistir no Firestore. */
  internalPath?: string;
  dataAiHint?: string;
}

interface DocumentsContextType {
  documents: DocumentType[];
  loading: boolean;
  addDocument: (doc: Omit<DocumentType, 'id'>) => Promise<WithId<Omit<DocumentType, 'id'>>>;
  updateDocument: (doc: DocumentType) => Promise<void>;
  deleteDocumentMutation: UseMutationResult<void, Error, string, unknown>;
}

const DocumentsContext = createContext<DocumentsContextType | undefined>(undefined);
const COLLECTION_NAME = 'documents';

export const DocumentsProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: documents = [], isFetching } = useQuery<DocumentType[]>({
    queryKey: [COLLECTION_NAME],
    queryFn: () => getCollection<DocumentType>(COLLECTION_NAME),
    staleTime: Infinity,
    enabled: !!user,
  });

  React.useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToCollection<DocumentType>(
      COLLECTION_NAME,
      (newData) => {
        queryClient.setQueryData([COLLECTION_NAME], newData);
      },
      (error) => {
        console.error("Failed to listen to documents collection:", error);
      }
    );
    return () => unsubscribe();
  }, [queryClient, user]);


  const addDocumentMutation = useMutation<WithId<Omit<DocumentType, 'id'>>, Error, Omit<DocumentType, 'id'>>({
    mutationFn: (docData: Omit<DocumentType, 'id'>) => {
      const payload = { ...docData } as Record<string, unknown>;
      if (!(payload.type === "interno" && payload.internalPath)) {
        delete payload.internalPath;
      }
      return addDocumentToCollection(COLLECTION_NAME, payload as Omit<DocumentType, "id">);
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const updateDocumentMutation = useMutation<void, Error, DocumentType>({
    mutationFn: (updatedDoc: DocumentType) => {
      const { id, ...rest } = updatedDoc;
      const payload = { ...rest } as Record<string, unknown>;
      delete payload.id;
      if (!(payload.type === "interno" && payload.internalPath)) {
        delete payload.internalPath;
      }
      return updateDocumentInCollection(COLLECTION_NAME, id, payload);
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const deleteDocumentMutation = useMutation<void, Error, string>({
    mutationFn: (id: string) => deleteDocumentFromCollection(COLLECTION_NAME, id),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const value = useMemo(() => ({
    documents,
    loading: isFetching,
    addDocument: (doc: Omit<DocumentType, 'id'>) => addDocumentMutation.mutateAsync(doc),
    updateDocument: (doc: DocumentType) => updateDocumentMutation.mutateAsync(doc),
    deleteDocumentMutation,
  }), [documents, isFetching, addDocumentMutation, updateDocumentMutation, deleteDocumentMutation]);

  return (
    <DocumentsContext.Provider value={value}>
      {children}
    </DocumentsContext.Provider>
  );
};

export const useDocuments = (): DocumentsContextType => {
  const context = useContext(DocumentsContext);
  if (context === undefined) {
    throw new Error('useDocuments must be used within a DocumentsProvider');
  }
  return context;
};

