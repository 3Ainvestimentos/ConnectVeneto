"use client";

import { useEffect, useRef, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from '@/lib/firebase';
import { filterDocumentsLocally, type UnifiedDocument } from '@/lib/document-search';

const DEBOUNCE_MS = 700;
const MIN_QUERY_LENGTH = 2;

type SearchState = {
  /** Resultados exibidos: ranking da IA quando disponível, senão o filtro local. */
  results: UnifiedDocument[];
  isSearching: boolean;
  /** true quando a ordem veio do modelo, e não do filtro textual. */
  isRanked: boolean;
  error: string | null;
};

/**
 * Busca por descrição sobre os dois acervos.
 *
 * Enquanto a pessoa digita, o filtro textual local responde na hora; após a pausa,
 * a busca por IA reordena por aderência. Se a IA falhar, o filtro local continua
 * valendo — a busca nunca fica sem resposta.
 */
export function useDocumentSearch(
  documents: UnifiedDocument[],
  query: string
): SearchState {
  const [rankedKeys, setRankedKeys] = useState<string[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Descarta respostas de buscas antigas que chegarem fora de ordem.
  const latestQueryRef = useRef(query);
  latestQueryRef.current = query;

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      setRankedKeys(null);
      setIsSearching(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const currentUser = getAuth(getFirebaseApp()).currentUser;
        if (!currentUser) throw new Error('Sessão expirada. Entre novamente.');

        const token = await currentUser.getIdToken();
        const response = await fetch('/api/biblioteca-comercial/search', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: trimmedQuery }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { keys?: string[]; error?: string }
          | null;

        if (!response.ok || !payload?.keys) {
          throw new Error(payload?.error ?? 'Não foi possível buscar agora.');
        }

        if (cancelled || latestQueryRef.current.trim() !== trimmedQuery) return;
        setRankedKeys(payload.keys);
        setError(null);
      } catch (caught) {
        if (cancelled) return;
        // Sem ranking da IA, o filtro local assume — por isso não limpamos a lista.
        setRankedKeys(null);
        setError(caught instanceof Error ? caught.message : 'Não foi possível buscar agora.');
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  if (trimmedQuery.length < MIN_QUERY_LENGTH) {
    return { results: documents, isSearching: false, isRanked: false, error: null };
  }

  if (rankedKeys) {
    const byKey = new Map(documents.map((document) => [document.key, document]));
    const ranked = rankedKeys
      .map((key) => byKey.get(key))
      .filter((document): document is UnifiedDocument => !!document);
    return { results: ranked, isSearching, isRanked: true, error };
  }

  return {
    results: filterDocumentsLocally(documents, trimmedQuery),
    isSearching,
    isRanked: false,
    error,
  };
}
