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

function Tile({ item }: { item: Indicator }) {
  const Icon = item.trend === 'up' ? ArrowUpRight : item.trend === 'down' ? ArrowDownRight : Minus;
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-card px-3 py-2.5 shadow-sm" title={item.hint ? `${item.label} · ${item.hint}` : item.label}>
      <span className="truncate text-sm font-medium text-muted-foreground">{item.label}</span>
      <span className="truncate font-headline text-lg font-bold leading-tight tabular-nums xl:text-xl">{item.value}</span>
      <span className={cn('inline-flex min-w-0 items-center gap-1 text-sm font-semibold tabular-nums', TONE[item.tone])} title={item.delta}>
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{item.delta}</span>
      </span>
    </div>
  );
}

function Group({
  icon: Icon,
  title,
  note,
  restricted,
  items,
  className,
  gridClassName,
}: {
  icon: LucideIcon;
  title: string;
  note: string;
  restricted?: boolean;
  items: Indicator[];
  className?: string;
  gridClassName: string;
}) {
  return (
    <section className={cn('grid min-w-0 content-start gap-3 rounded-xl border p-4', className)} aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="inline-flex items-center gap-2 font-headline text-base font-semibold">
          <Icon className="h-4 w-4" aria-hidden />
          {title}
          {restricted && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Restrito" />}
        </h3>
        <span className="text-xs text-muted-foreground">{note}</span>
      </div>
      <div className={cn('grid gap-2', gridClassName)}>
        {items.map((i) => (
          <Tile key={i.label} item={i} />
        ))}
      </div>
    </section>
  );
}

/**
 * Indicadores no topo da Home, em dois blocos separados: os da Vêneto (só para quem tem acesso a
 * Dados Estratégicos) e os de mercado. Tudo cabe na largura, sem rolagem.
 */
export function IndicatorsStrip({ canSeeStrategic }: { canSeeStrategic: boolean }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <h2 className="font-headline text-lg font-semibold">Indicadores</h2>
        <ExampleDataBadge />
      </div>
      <div className={cn('grid gap-4', canSeeStrategic && 'xl:grid-cols-[3fr_5fr]')}>
        {canSeeStrategic && (
          <Group
            icon={Building2}
            title="Vêneto"
            note="Fechamento do mês anterior"
            restricted
            items={STRATEGIC_INDICATORS}
            className="border-primary/30 bg-primary/[0.06]"
            gridClassName="grid-cols-2 sm:grid-cols-3"
          />
        )}
        <Group
          icon={LineChart}
          title="Mercado"
          note="Cotações com atraso"
          items={MARKET_INDICATORS}
          className="bg-muted/40"
          gridClassName="grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
        />
      </div>
    </div>
  );
}
