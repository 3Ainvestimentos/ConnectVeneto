"use client";

import { CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PERIODS, type Period } from '@/lib/hub/periods';

/** "Acontece em": recorta o feed para eventos e enquetes de uma janela de tempo. */
export function PeriodFilter({ value, onChange, className }: { value: Period; onChange: (p: Period) => void; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <CalendarRange className="h-4 w-4" /> Acontece em
      </span>
      <div className="inline-flex flex-wrap rounded-lg bg-muted p-1 text-sm" role="radiogroup" aria-label="Acontece em">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={value === p.id}
            onClick={() => onChange(p.id)}
            className={cn(
              'rounded-md px-3 py-1.5 font-medium transition-colors',
              value === p.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
