"use client";

import { useCallback, useEffect, useMemo } from "react";
import { getAuth } from "firebase/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCollection, listenToCollection } from "@/lib/firestore-service";
import { getFirebaseApp } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
  defaultMixServicosSlides,
  type RegrasComerciaisSlide,
  type RegrasComerciaisSlideDoc,
} from "@/config/regras-comerciais-slides";

export const MIX_SLIDES_COLLECTION = "regrasComerciaisSlides";

const sortByOrder = (slides: RegrasComerciaisSlideDoc[]): RegrasComerciaisSlideDoc[] =>
  [...slides].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/**
 * Slides do carrossel "Apresentação — Mix de Serviços".
 *
 * Leitura: coleção `regrasComerciaisSlides` (Firestore, realtime). Enquanto ninguém
 * tiver editado nada, a coleção está vazia e caímos no baseline em código
 * (`defaultMixServicosSlides`) — a página nunca fica sem slides.
 *
 * Escrita: nunca direto no Firestore. As regras liberam apenas leitura; a gravação
 * passa por `PUT /api/regras-comerciais/slides`, que valida a permissão
 * `canManageRegrasComerciais` server-side com o Admin SDK.
 */
export function useMixServicosSlides() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEnabled = !!user;

  const { data: storedSlides = [], isFetching } = useQuery<RegrasComerciaisSlideDoc[]>({
    queryKey: [MIX_SLIDES_COLLECTION],
    queryFn: () => getCollection<RegrasComerciaisSlideDoc>(MIX_SLIDES_COLLECTION),
    staleTime: Infinity,
    enabled: isEnabled,
  });

  useEffect(() => {
    if (!isEnabled) return;
    const unsubscribe = listenToCollection<RegrasComerciaisSlideDoc>(
      MIX_SLIDES_COLLECTION,
      (newData) => {
        queryClient.setQueryData([MIX_SLIDES_COLLECTION], newData);
      },
      (error) => {
        console.error(`[${MIX_SLIDES_COLLECTION}] realtime listener error:`, error);
      }
    );
    return () => unsubscribe();
  }, [queryClient, isEnabled]);

  const isCustomized = storedSlides.length > 0;

  const slides: RegrasComerciaisSlide[] = useMemo(() => {
    if (!isCustomized) return defaultMixServicosSlides;
    return sortByOrder(storedSlides).map(({ src, alt }) => ({ src, alt }));
  }, [isCustomized, storedSlides]);

  const orderedStoredSlides = useMemo(() => sortByOrder(storedSlides), [storedSlides]);

  const saveMutation = useMutation<void, Error, RegrasComerciaisSlide[]>({
    mutationFn: async (nextSlides) => {
      const currentUser = getAuth(getFirebaseApp()).currentUser;
      if (!currentUser) throw new Error("Sessão expirada. Entre novamente para salvar.");

      const token = await currentUser.getIdToken();
      const response = await fetch("/api/regras-comerciais/slides", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slides: nextSlides }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Não foi possível salvar os slides.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MIX_SLIDES_COLLECTION] });
    },
  });

  const saveSlides = useCallback(
    (nextSlides: RegrasComerciaisSlide[]) => saveMutation.mutateAsync(nextSlides),
    [saveMutation]
  );

  return {
    /** Slides efetivamente exibidos (Firestore quando houver, senão o baseline). */
    slides,
    /** Documentos brutos ordenados — útil na tela de administração. */
    storedSlides: orderedStoredSlides,
    /** true quando já existe configuração salva no Firestore. */
    isCustomized,
    loading: isFetching,
    saveSlides,
    isSaving: saveMutation.isPending,
  };
}
