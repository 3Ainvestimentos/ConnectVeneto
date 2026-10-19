'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, Clock, CheckCircle, ExternalLink, RotateCw } from 'lucide-react';
import Link from 'next/link';

type SummaryItem = {
  id: string;
  title: string;
  dueAt: string;
  status: string;
  isAssignee: boolean;
};

type SummaryData = {
  counts: { overdue: number; dueSoon: number; open: number };
  urgentItems: SummaryItem[];
};

function formatDue(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/**
 * `full` (/dashboard): contadores, urgentes e link, empilhados. `compact`: só contadores e link.
 * `wide` (nova Home): contadores à esquerda e urgentes à direita, em telas médias para cima.
 */
export default function TrackFlowSummary({ variant = 'full' }: { variant?: 'full' | 'compact' | 'wide' } = {}) {
  const compact = variant === 'compact';
  const wide = variant === 'wide';
  const tile = wide ? 'flex flex-col items-center justify-center rounded-lg p-3' : 'flex flex-col items-center rounded-lg p-2';
  const num = wide ? 'text-3xl' : 'text-xl';
  const label = wide ? 'text-sm' : 'text-xs';
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<SummaryData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // Aguarda o Firebase restaurar a sessão antes de decidir entre fetch e erro —
    // no primeiro acesso, currentUser ainda é null enquanto authLoading=true.
    if (authLoading) return;
    if (!user) { setError(true); setLoading(false); return; }

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
        const json: SummaryData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading, reloadKey]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        {(compact ? [1] : [1, 2, 3]).map((i) => (
          <div key={i} className={compact ? 'h-16 rounded-lg bg-muted' : 'h-12 rounded-lg bg-muted'} />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-start gap-2 py-2">
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar as tarefas.
        </p>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCw className="w-3 h-3" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const { counts, urgentItems } = data;
  const total = counts.overdue + counts.dueSoon + counts.open;

  return (
    <div className={wide ? 'grid gap-4 md:grid-cols-[minmax(240px,2fr)_3fr] md:items-start md:gap-6' : 'flex flex-col gap-3'}>
      {/* Counters */}
      <div className="grid grid-cols-3 gap-2">
        <div className={`${tile} bg-red-50 dark:bg-red-950/30`}>
          <AlertCircle className="w-4 h-4 text-red-500 mb-1" />
          <span className={`${num} font-bold text-red-600 dark:text-red-400 leading-none`}>{counts.overdue}</span>
          <span className={`${label} text-red-500 mt-0.5`}>Atrasadas</span>
        </div>
        <div className={`${tile} bg-amber-50 dark:bg-amber-950/30`}>
          <Clock className="w-4 h-4 text-amber-500 mb-1" />
          <span className={`${num} font-bold text-amber-600 dark:text-amber-400 leading-none`}>{counts.dueSoon}</span>
          <span className={`${label} text-amber-500 mt-0.5`}>Em breve</span>
        </div>
        <div className={`${tile} bg-emerald-50 dark:bg-emerald-950/30`}>
          <CheckCircle className="w-4 h-4 text-emerald-500 mb-1" />
          <span className={`${num} font-bold text-emerald-600 dark:text-emerald-400 leading-none`}>{counts.open}</span>
          <span className={`${label} text-emerald-500 mt-0.5`}>Abertas</span>
        </div>
      </div>

      {/* Urgent items */}
      {compact ? null : urgentItems.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {(wide ? urgentItems.slice(0, 4) : urgentItems).map((item) => {
            const isLate = item.status === 'atrasada' || new Date(item.dueAt) < new Date();
            return (
              <div
                key={item.id}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${wide ? 'text-base' : 'text-sm'} ${
                  isLate
                    ? 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20'
                    : 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-foreground">{item.title}</p>
                  <p className={`${wide ? 'text-sm' : 'text-xs'} ${isLate ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'}`}>
                    {item.isAssignee ? 'Para responder' : 'Sua solicitação'} · {formatDue(item.dueAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={wide ? 'self-center text-base text-muted-foreground' : 'text-sm text-muted-foreground text-center py-1'}>
          {total === 0 ? 'Nenhuma tarefa pendente.' : 'Nenhuma urgência no momento.'}
        </p>
      )}

      <Link
        href="/trackflow"
        className={
          wide
            ? 'inline-flex items-center gap-1.5 justify-self-start text-sm font-medium text-primary hover:underline md:col-span-2'
            : 'flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1'
        }
      >
        <ExternalLink className="w-3 h-3" />
        Ver todas as solicitações
      </Link>
    </div>
  );
}
