"use client";

import { ArrowDownRight, ArrowUpRight, Building2, LineChart, Lock, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MARKET_INDICATORS, STRATEGIC_INDICATORS } from '@/lib/hub-mock/data';
import type { Indicator } from '@/lib/hub-mock/types';
import { ExampleDataBadge } from './HubPilotGate';

const TONE = {
  positive: 'text-emerald-700 dark:text-emerald-300',
  negative: 'text-red-700 dark:text-red-300',
  neutral: 'text-muted-foreground',
};

/** `dense`: coluna lateral (3 cartões em ~360px), valor um pouco menor para não cortar. */
function Tile({ item, dense }: { item: Indicator; dense?: boolean }) {
  const Icon = item.trend === 'up' ? ArrowUpRight : item.trend === 'down' ? ArrowDownRight : Minus;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-lg bg-card py-3 shadow-sm', dense ? 'px-2.5' : 'px-3')} title={item.hint ? `${item.label} · ${item.hint}` : item.label}>
      <span className="truncate text-sm font-medium text-muted-foreground">{item.label}</span>
      <span className={cn('truncate font-headline font-bold leading-tight tabular-nums', dense ? 'text-base xl:text-lg' : 'text-lg')}>{item.value}</span>
      <span className={cn('inline-flex min-w-0 items-center gap-1 text-sm font-semibold tabular-nums', TONE[item.tone])} title={item.delta}>
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{item.delta}</span>
      </span>
    </div>
  );
}

function IndicatorGroup({
  icon: Icon,
  title,
  note,
  restricted,
  items,
  className,
  gridClassName,
  dense,
}: {
  icon: LucideIcon;
  title: string;
  note: string;
  restricted?: boolean;
  items: Indicator[];
  className?: string;
  gridClassName: string;
  dense?: boolean;
}) {
  return (
    <section className={cn('grid h-full min-w-0 content-start gap-4 rounded-xl border p-5 shadow-sm', className)} aria-label={`Indicadores ${title}`}>
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="inline-flex items-center gap-2 font-headline text-lg font-semibold">
          <Icon className="h-5 w-5 text-primary" aria-hidden />
          {title}
          {restricted && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Restrito" />}
        </h2>
        <ExampleDataBadge />
      </div>
      <div className={cn('grid gap-2', gridClassName)}>
        {items.map((i) => (
          <Tile key={i.label} item={i} dense={dense} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
    </section>
  );
}

/** Mercado: cotações de referência. Fica na coluna principal da Home, na largura do To-do. */
export function MarketIndicators() {
  return (
    <IndicatorGroup
      icon={LineChart}
      title="Mercado"
      note="Cotações com atraso"
      items={MARKET_INDICATORS}
      className="bg-muted/40"
      gridClassName="grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
    />
  );
}

/** Vêneto: indicadores da empresa (só com acesso a Dados Estratégicos). Na coluna lateral, na largura dos Avisos. */
export function StrategicIndicators() {
  return (
    <IndicatorGroup
      icon={Building2}
      title="Vêneto"
      note="Fechamento do mês anterior · Dados Estratégicos"
      restricted
      items={STRATEGIC_INDICATORS}
      className="border-primary/30 bg-primary/[0.06]"
      gridClassName="grid-cols-3"
      dense
    />
  );
}
