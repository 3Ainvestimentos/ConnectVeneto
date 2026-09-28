"use client";

import { useEffect, useMemo } from 'react';
import { useFirestoreCollection } from '@/hooks/useFirestoreCollection';
import {
  FALLBACK_HUB_MODULES,
  HUB_MODULES_COLLECTION,
  parseHubModules,
  type HubModule,
} from '@/config/modules';

let warnedFallback = false;

/**
 * Registro de módulos do hub em tempo real (coleção `hubModules`), já validado e
 * ordenado por `order`. Enquanto a coleção estiver vazia ou inacessível (rules não
 * publicadas, banco não semeado, erro de rede), devolve o seed embutido no código.
 */
export function useHubModules(): { modules: HubModule[]; loading: boolean; isFallback: boolean } {
  const { items, loading } = useFirestoreCollection<HubModule>(HUB_MODULES_COLLECTION);

  const parsed = useMemo(() => parseHubModules(items as unknown[]), [items]);
  const isFallback = parsed.length === 0;

  useEffect(() => {
    if (isFallback && !loading && !warnedFallback) {
      warnedFallback = true;
      console.warn('[hubModules] coleção vazia ou inacessível; usando o registro embutido (hub-modules.seed.json).');
    }
  }, [isFallback, loading]);

  return {
    modules: isFallback ? FALLBACK_HUB_MODULES : parsed,
    loading,
    isFallback,
  };
}
