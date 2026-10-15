"use client";

import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Lock, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MARKET_INDICATORS, STRATEGIC_INDICATORS } from '@/lib/hub-mock/data';
import type { Indicator } from '@/lib/hub-mock/types';

const TONE = {
  positive: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  negative: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  neutral: 'bg-muted text-muted-foreground',
};

function Delta({ item }: { item: Indicator }) {
  const Icon = item.trend === 'up' ? ArrowUpRight : item.trend === 'down' ? ArrowDownRight : Minus;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums', TONE[item.tone])}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {item.delta}
    </span>
  );
}

function Row({ item }: { item: Indicator }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <div className="truncate text-base font-medium">{item.label}</div>
        {item.hint && <div className="truncate text-sm text-muted-foreground">{item.hint}</div>}
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className="font-headline text-lg font-bold leading-none tabular-nums">{item.value}</span>
        <Delta item={item} />
      </div>
    </div>
  );
}

/**
 * Indicadores da empresa e de mercado. A aba Estratégicos só existe para quem tem acesso ao módulo
 * Dados Estratégicos; os demais veem só Mercado, sem o seletor.
 */
export function IndicatorsCard({ canSeeStrategic }: { canSeeStrategic: boolean }) {
  const [tab, setTab] = useState<'estrategicos' | 'mercado'>(canSeeStrategic ? 'estrategicos' : 'mercado');
  const items = tab === 'estrategicos' ? STRATEGIC_INDICATORS : MARKET_INDICATORS;

  return (
    <Card className="shadow-sm">
      <div className="flex items-center justify-between gap-2 px-5 pt-5">
        <h3 className="font-headline text-lg font-semibold">Indicadores</h3>
        {canSeeStrategic && (
          <div className="inline-flex rounded-lg bg-muted p-1 text-sm" role="tablist" aria-label="Tipo de indicador">
            {(
              [
                ['estrategicos', 'Vêneto'],
                ['mercado', 'Mercado'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors',
                  tab === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
                {value === 'estrategicos' && <Lock className="h-3 w-3 opacity-60" aria-label="Restrito" />}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="divide-y px-5 pb-2 pt-2">
        {items.map((i) => (
          <Row key={i.label} item={i} />
        ))}
      </div>
      <p className="border-t px-5 py-3 text-sm text-muted-foreground">
        {tab === 'estrategicos' ? 'Fechamento do mês anterior · Dados Estratégicos' : 'Cotações com atraso · TradingView'}
      </p>
    </Card>
  );
}
