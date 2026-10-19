"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type TrackFlowSummaryItem = {
  id: string;
  title: string;
  dueAt: string;
  status: string;
  isAssignee: boolean;
};

export type TrackFlowSummaryData = {
  counts: { overdue: number; dueSoon: number; open: number };
  urgentItems: TrackFlowSummaryItem[];
};

/** Resumo das solicitações do TrackFlow da pessoa (`/api/modules/trackflow/summary`). */
export function useTrackFlowSummary() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<TrackFlowSummaryData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // Aguarda o Firebase restaurar a sessão antes de decidir entre fetch e erro —
    // no primeiro acesso, currentUser ainda é null enquanto authLoading=true.
    if (authLoading) return;
    if (!user) {
      setError(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/modules/trackflow/summary', {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('fetch failed');
        const json: TrackFlowSummaryData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, reloadKey]);

  return { data, error, loading, reload: () => setReloadKey((k) => k + 1) };
}

/** Atrasada pelo status do TrackFlow ou pela data já vencida. */
export const isLate = (item: TrackFlowSummaryItem, now = new Date()) => item.status === 'atrasada' || new Date(item.dueAt) < now;
