'use client';

import { AlertCircle, Clock, CheckCircle, ExternalLink, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { isLate, useTrackFlowSummary } from '@/hooks/useTrackFlowSummary';

function formatDue(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** `full` (/dashboard): contadores, urgentes e link. `compact`: só contadores e link. A nova Home usa o `TodoCard`. */
export default function TrackFlowSummary({ variant = 'full' }: { variant?: 'full' | 'compact' } = {}) {
  const compact = variant === 'compact';
  const { data, error, loading, reload } = useTrackFlowSummary();

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
          onClick={reload}
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
    <div className="flex flex-col gap-3">
      {/* Counters */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center rounded-lg bg-red-50 dark:bg-red-950/30 p-2">
          <AlertCircle className="w-4 h-4 text-red-500 mb-1" />
          <span className="text-xl font-bold text-red-600 dark:text-red-400 leading-none">{counts.overdue}</span>
          <span className="text-xs text-red-500 mt-0.5">Atrasadas</span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2">
          <Clock className="w-4 h-4 text-amber-500 mb-1" />
          <span className="text-xl font-bold text-amber-600 dark:text-amber-400 leading-none">{counts.dueSoon}</span>
          <span className="text-xs text-amber-500 mt-0.5">Em breve</span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2">
          <CheckCircle className="w-4 h-4 text-emerald-500 mb-1" />
          <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 leading-none">{counts.open}</span>
          <span className="text-xs text-emerald-500 mt-0.5">Abertas</span>
        </div>
      </div>

      {/* Urgent items */}
      {compact ? null : urgentItems.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {urgentItems.map((item) => {
            const late = isLate(item);
            return (
              <div
                key={item.id}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  late
                    ? 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20'
                    : 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-foreground">{item.title}</p>
                  <p className={`text-xs ${late ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'}`}>
                    {item.isAssignee ? 'Para responder' : 'Sua solicitação'} · {formatDue(item.dueAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-1">
          {total === 0 ? 'Nenhuma tarefa pendente.' : 'Nenhuma urgência no momento.'}
        </p>
      )}

      <Link
        href="/trackflow"
        className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
      >
        <ExternalLink className="w-3 h-3" />
        Ver todas as solicitações
      </Link>
    </div>
  );
}
