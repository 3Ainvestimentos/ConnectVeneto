"use client";

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { parseTrackflowFluxos, type TrackflowFluxo } from '@/lib/trackflow/fluxos';

/** Acima disso a página segue só com a lista fixa (o proxy já desiste em 8 s). */
const CLIENT_TIMEOUT_MS = 10_000;

const EMPTY: TrackflowFluxo[] = [];

/**
 * Fluxos do TrackFlow que a pessoa pode abrir (`/api/modules/trackflow/fluxos`).
 * Qualquer falha (TrackFlow fora do ar, timeout, sem acesso) vira lista vazia, sem erro na tela:
 * quem chama nunca precisa tratar erro nem esperar por esta busca.
 */
export function useTrackFlowFluxos(): TrackflowFluxo[] {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['trackflow', 'fluxos', user?.uid ?? null],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TrackflowFluxo[]> => {
      if (!user) return EMPTY;
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/modules/trackflow/fluxos', {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: 'no-store',
          signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
        });
        if (!res.ok) return EMPTY;
        return parseTrackflowFluxos(await res.json());
      } catch {
        return EMPTY;
      }
    },
  });

  return query.data ?? EMPTY;
}
