"use client";

import { ArrowDownRight, ArrowUpRight, Building2, LineChart, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import TradingViewWidget from '@/components/dashboard-v2/TradingViewWidget';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';
import { STRATEGIC_INDICATORS } from '@/lib/hub-mock/data';
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
  items,
  className,
  gridClassName,
  dense,
}: {
  icon: LucideIcon;
  title: string;
  note: string;
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

/**
 * Mercado: o mesmo painel do TradingView do Painel Inicial (moedas, índices, futuros, com gráfico).
 * Fecha a coluna principal da Home (é a informação menos urgente) e o gráfico ocupa a altura que
 * sobrar para a coluna terminar junto com a lateral.
 */
export function MarketIndicators() {
  return (
    <section className="flex h-full min-w-0 flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm" aria-label="Indicadores de mercado">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="inline-flex items-center gap-2 font-headline text-lg font-semibold">
          <LineChart className="h-5 w-5 text-primary" aria-hidden /> Mercado
        </h2>
        <span className="text-xs text-muted-foreground">Cotações com atraso · TradingView</span>
      </div>
      <div className="min-h-[420px] min-w-0 flex-1">
        <WidgetErrorBoundary title="Mercado indisponível">
          <TradingViewWidget />
        </WidgetErrorBoundary>
      </div>
    </section>
  );
}

/** Indicadores Estratégicos da Vêneto (só com acesso a Dados Estratégicos). Na coluna lateral, na largura dos Avisos. */
export function StrategicIndicators() {
  return (
    <IndicatorGroup
      icon={Building2}
      title="Indicadores Estratégicos"
      note="Fechamento do mês anterior · Dados Estratégicos"
      items={STRATEGIC_INDICATORS}
      className="border-primary/30 bg-primary/[0.06]"
      gridClassName="grid-cols-3"
      dense
    />
  );
}
