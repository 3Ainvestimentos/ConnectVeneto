"use client";

import { useCallback, useEffect, useMemo } from 'react';
import { getAuth } from 'firebase/auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCollection, listenToCollection } from '@/lib/firestore-service';
import { getFirebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  COMMERCIAL_DOCUMENTS_COLLECTION,
  type CommercialDocument,
} from '@/config/biblioteca-comercial';

export type CommercialDocumentDraft = {
  title: string;
  description: string;
  tags: string[];
  sourceType: 'upload' | 'link';
  fileType: CommercialDocument['fileType'];
  downloadUrl: string;
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
};

export type CommercialDocumentEdit = {
  id: string;
  title: string;
  description: string;
  tags: string[];
};

const API_PATH = '/api/biblioteca-comercial/documents';

/** Toda escrita passa pela API route, que valida `canManageBibliotecaComercial`. */
const authorizedRequest = async (
  url: string,
  init: { method: string; body?: unknown }
): Promise<void> => {
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

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? 'Não foi possível concluir a operação.');
  }
};

/**
 * Biblioteca Comercial — acervo da aba "Comercial" em /documents.
 *
 * Leitura: direto na coleção `commercialDocuments` (realtime, como as demais coleções).
 * Escrita: nunca direto no Firestore — as rules liberam só leitura, e a permissão
 * `canManageBibliotecaComercial` mora no documento do colaborador, que elas não
 * conseguem consultar por e-mail.
 */
export function useCommercialDocuments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEnabled = !!user;

  const { data: documents = [], isFetching } = useQuery<CommercialDocument[]>({
    queryKey: [COMMERCIAL_DOCUMENTS_COLLECTION],
    queryFn: () => getCollection<CommercialDocument>(COMMERCIAL_DOCUMENTS_COLLECTION),
    staleTime: Infinity,
    enabled: isEnabled,
  });

  useEffect(() => {
    if (!isEnabled) return;
    const unsubscribe = listenToCollection<CommercialDocument>(
      COMMERCIAL_DOCUMENTS_COLLECTION,
      (newData) => {
        queryClient.setQueryData([COMMERCIAL_DOCUMENTS_COLLECTION], newData);
      },
      (error) => {
        console.error(`[${COMMERCIAL_DOCUMENTS_COLLECTION}] realtime listener error:`, error);
      }
    );
    return () => unsubscribe();
  }, [queryClient, isEnabled]);

  /** Mais recentes primeiro — a ordenação da vitrine é por relevância de uso, não alfabética. */
  const sortedDocuments = useMemo(
    () => [...documents].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [documents]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [COMMERCIAL_DOCUMENTS_COLLECTION] });
  }, [queryClient]);

  const createMutation = useMutation<void, Error, CommercialDocumentDraft>({
    mutationFn: (draft) => authorizedRequest(API_PATH, { method: 'POST', body: draft }),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation<void, Error, CommercialDocumentEdit>({
    mutationFn: ({ id, ...fields }) =>
      authorizedRequest(`${API_PATH}?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: fields,
      }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) =>
      authorizedRequest(`${API_PATH}?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  return {
    documents: sortedDocuments,
    loading: isFetching,
    createDocument: (draft: CommercialDocumentDraft) => createMutation.mutateAsync(draft),
    updateDocument: (edit: CommercialDocumentEdit) => updateMutation.mutateAsync(edit),
    deleteDocument: (id: string) => deleteMutation.mutateAsync(id),
    isSaving: createMutation.isPending || updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
