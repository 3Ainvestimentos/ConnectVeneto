"use client";

import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, Inbox, ListTodo, RotateCw, Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { isLate, useTrackFlowSummary, type TrackFlowSummaryItem } from '@/hooks/useTrackFlowSummary';
import { cn } from '@/lib/utils';
import { relativeDay, shortDate } from './format';

const MAX_PER_GROUP = 4;

function dueText(item: TrackFlowSummaryItem): string {
  if (isLate(item)) return `atrasada desde ${shortDate(item.dueAt)}`;
  return `vence ${relativeDay(item.dueAt)}`;
}

function Counter({ value, label, tone }: { value: number; label: string; tone: 'red' | 'amber' | 'neutral' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
        tone === 'red' && value > 0 && 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
        tone === 'amber' && value > 0 && 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
        (tone === 'neutral' || value === 0) && 'bg-muted text-muted-foreground',
      )}
    >
      <b className="tabular-nums">{value}</b> {label}
    </span>
  );
}

function TaskRow({ item }: { item: TrackFlowSummaryItem }) {
  const late = isLate(item);
  const Icon = late ? AlertCircle : Clock;
  return (
    <li>
      <Link href="/trackflow" className="-mx-2 flex items-center gap-3 rounded-lg p-2 hover:bg-muted">
        <Icon className={cn('h-5 w-5 shrink-0', late ? 'text-red-500' : 'text-amber-500')} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-base font-medium">{item.title}</span>
        <span
          className={cn(
            'shrink-0 rounded-md px-2 py-0.5 text-sm font-medium tabular-nums',
            late ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
          )}
        >
          {dueText(item)}
        </span>
      </Link>
    </li>
  );
}

function Group({ icon: Icon, title, items }: { icon: typeof Inbox; title: string; items: TrackFlowSummaryItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="grid gap-1">
      <h3 className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {title} · {items.length}
      </h3>
      <ul className="grid">
        {items.slice(0, MAX_PER_GROUP).map((i) => (
          <TaskRow key={i.id} item={i} />
        ))}
      </ul>
      {items.length > MAX_PER_GROUP && (
        <Link href="/trackflow" className="text-sm text-muted-foreground hover:text-foreground">
          + {items.length - MAX_PER_GROUP} no TrackFlow
        </Link>
      )}
    </section>
  );
}

/**
 * To-do da Home: o que está pendente no TrackFlow, separado entre o que a pessoa precisa
 * responder e o que ela pediu e está esperando. Do mais atrasado para o mais distante.
 */
export function TodoCard() {
  const { data, error, loading, reload } = useTrackFlowSummary();
  const byDue = (a: TrackFlowSummaryItem, b: TrackFlowSummaryItem) => a.dueAt.localeCompare(b.dueAt);
  const toAnswer = (data?.urgentItems ?? []).filter((i) => i.isAssignee).sort(byDue);
  const mine = (data?.urgentItems ?? []).filter((i) => !i.isAssignee).sort(byDue);
  const total = data ? data.counts.overdue + data.counts.dueSoon + data.counts.open : 0;

  return (
    <Card className="shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <h2 className="inline-flex items-center gap-2 font-headline text-lg font-semibold">
          <ListTodo className="h-5 w-5 text-primary" aria-hidden /> To-do
        </h2>
        {data && (
          <div className="flex flex-wrap gap-2" aria-label="Resumo das tarefas">
            <Counter value={data.counts.overdue} label={data.counts.overdue === 1 ? 'atrasada' : 'atrasadas'} tone="red" />
            <Counter value={data.counts.dueSoon} label="vencem em breve" tone="amber" />
            <Counter value={data.counts.open} label="em aberto" tone="neutral" />
          </div>
        )}
      </div>

      <div className="grid gap-4 px-5 pb-5 pt-4">
        {loading && (
          <div className="grid animate-pulse gap-2">
            <div className="h-9 rounded-lg bg-muted" />
            <div className="h-9 rounded-lg bg-muted" />
          </div>
        )}
        {!loading && (error || !data) && (
          <div className="flex flex-wrap items-center gap-3 text-base text-muted-foreground">
            Não foi possível carregar suas tarefas do TrackFlow.
            <button type="button" onClick={reload} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <RotateCw className="h-3.5 w-3.5" /> Tentar de novo
            </button>
          </div>
        )}
        {data && toAnswer.length + mine.length === 0 && (
          <p className="flex items-center gap-2 text-base text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
            {total === 0 ? 'Tudo em dia: nenhuma tarefa pendente.' : 'Nada urgente agora.'}
          </p>
        )}
        {data && (
          <div className={cn('grid gap-4', toAnswer.length > 0 && mine.length > 0 && 'md:grid-cols-2 md:gap-6')}>
            <Group icon={Inbox} title="Para você responder" items={toAnswer} />
            <Group icon={Send} title="Suas solicitações" items={mine} />
          </div>
        )}
        <Link href="/trackflow" className="inline-flex items-center gap-1 justify-self-start text-sm font-medium text-primary hover:underline">
          Abrir o TrackFlow <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Card>
  );
}
