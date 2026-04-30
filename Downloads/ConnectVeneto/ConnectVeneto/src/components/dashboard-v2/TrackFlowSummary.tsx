'use client';

import { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from '@/lib/firebase';
import { AlertCircle, Clock, CheckCircle, ExternalLink } from 'lucide-react';
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

export default function TrackFlowSummary() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const auth = getAuth(getFirebaseApp());
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) { setError(true); setLoading(false); return; }

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
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Não foi possível carregar as tarefas.
      </p>
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
          <span className="text-[10px] text-red-500 mt-0.5">Atrasadas</span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2">
          <Clock className="w-4 h-4 text-amber-500 mb-1" />
          <span className="text-xl font-bold text-amber-600 dark:text-amber-400 leading-none">{counts.dueSoon}</span>
          <span className="text-[10px] text-amber-500 mt-0.5">Em breve</span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2">
          <CheckCircle className="w-4 h-4 text-emerald-500 mb-1" />
          <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 leading-none">{counts.open}</span>
          <span className="text-[10px] text-emerald-500 mt-0.5">Abertas</span>
        </div>
      </div>

      {/* Urgent items */}
      {urgentItems.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {urgentItems.map((item) => {
            const isLate = item.status === 'atrasada' || new Date(item.dueAt) < new Date();
            return (
              <div
                key={item.id}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  isLate
                    ? 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20'
                    : 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-foreground">{item.title}</p>
                  <p className={`text-xs ${isLate ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'}`}>
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
