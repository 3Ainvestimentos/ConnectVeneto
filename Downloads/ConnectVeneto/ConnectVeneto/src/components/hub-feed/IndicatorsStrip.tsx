"use client";

import { ArrowDownRight, ArrowUpRight, Lock, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MARKET_INDICATORS, STRATEGIC_INDICATORS } from '@/lib/hub-mock/data';
import type { Indicator } from '@/lib/hub-mock/types';
import { ExampleDataBadge } from './HubPilotGate';

const TONE = {
  positive: 'text-emerald-700 dark:text-emerald-300',
  negative: 'text-red-700 dark:text-red-300',
  neutral: 'text-muted-foreground',
};

function Tile({ item }: { item: Indicator }) {
  const Icon = item.trend === 'up' ? ArrowUpRight : item.trend === 'down' ? ArrowDownRight : Minus;
  return (
    <div className="flex min-w-[148px] flex-1 snap-start flex-col gap-1 rounded-lg bg-muted/50 px-4 py-3" title={item.hint}>
      <span className="truncate text-sm font-medium text-muted-foreground">{item.label}</span>
      <span className="font-headline text-xl font-bold leading-tight tabular-nums">{item.value}</span>
      <span className={cn('inline-flex min-w-0 items-center gap-1 text-sm font-semibold tabular-nums', TONE[item.tone])}>
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{item.delta}</span>
      </span>
    </div>
  );
}

function Group({ label, restricted, items }: { label: string; restricted?: boolean; items: Indicator[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-2" role="group" aria-label={label}>
      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
        {restricted && <Lock className="h-3 w-3" aria-label="Restrito" />}
      </span>
      <div className="flex gap-2">
        {items.map((i) => (
          <Tile key={i.label} item={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Faixa de indicadores no topo da Home: leitura rápida, sem gráfico. Os da Vêneto só aparecem para
 * quem tem acesso a Dados Estratégicos.
 */
export function IndicatorsStrip({ canSeeStrategic }: { canSeeStrategic: boolean }) {
  return (
    <section className="rounded-xl border bg-card px-5 py-4 shadow-sm" aria-labelledby="indicadores-titulo">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="indicadores-titulo" className="inline-flex items-center gap-2 font-headline text-lg font-semibold">
          Indicadores <ExampleDataBadge />
        </h2>
        <span className="text-sm text-muted-foreground">
          {canSeeStrategic ? 'Vêneto: fechamento do mês anterior · ' : ''}Mercado: cotações com atraso
        </span>
      </div>
      <div className="-mx-5 flex snap-x gap-6 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {canSeeStrategic && <Group label="Vêneto" restricted items={STRATEGIC_INDICATORS} />}
        <Group label="Mercado" items={MARKET_INDICATORS} />
      </div>
    </section>
  );
}
