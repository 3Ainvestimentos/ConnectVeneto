"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDocument, setDocumentInCollection } from "@/lib/firestore-service";
import { useAuth } from "@/contexts/AuthContext";
import {
  SolicitationArea,
  venetoSolicitacoesAreas,
} from "@/config/veneto-solicitacoes";

/**
 * Configuração da página Solicitações (/applications), editada em Admin › Conteúdo.
 * Fica num documento só (`solicitacoesConfig/areas`) com a lista inteira de áreas e
 * itens. Enquanto o documento não existir, vale a lista fixa de veneto-solicitacoes.ts.
 */
export const SOLICITACOES_COLLECTION = "solicitacoesConfig";
export const SOLICITACOES_DOC_ID = "areas";
const QUERY_KEY = [SOLICITACOES_COLLECTION, SOLICITACOES_DOC_ID];

type SolicitacoesConfigDoc = {
  areas: SolicitationArea[];
  updatedAt?: string;
  updatedBy?: string;
};

export function useSolicitacoesConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => getDocument<SolicitacoesConfigDoc>(SOLICITACOES_COLLECTION, SOLICITACOES_DOC_ID),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const stored = query.data?.areas;
  const isCustomized = Array.isArray(stored);
  const areas: SolicitationArea[] = isCustomized ? stored : venetoSolicitacoesAreas;

  const saveMutation = useMutation({
    mutationFn: async (nextAreas: SolicitationArea[]) => {
      const payload: SolicitacoesConfigDoc = {
        areas: nextAreas,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email ?? undefined,
      };
      await setDocumentInCollection<SolicitacoesConfigDoc>(
        SOLICITACOES_COLLECTION,
        SOLICITACOES_DOC_ID,
        payload
      );
      return payload;
    },
    onSuccess: (payload) => {
      queryClient.setQueryData(QUERY_KEY, { id: SOLICITACOES_DOC_ID, ...payload });
    },
  });

  return {
    areas,
    isCustomized,
    updatedAt: query.data?.updatedAt,
    updatedBy: query.data?.updatedBy,
    loading: query.isLoading,
    saveAreas: saveMutation.mutateAsync,
    saving: saveMutation.isPending,
  };
}
