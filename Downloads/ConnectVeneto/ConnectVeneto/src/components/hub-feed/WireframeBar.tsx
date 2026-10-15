"use client";

import { FlaskConical, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHubMock } from '@/lib/hub-mock/store';
import type { ViewerRole } from '@/lib/hub-mock/types';

/** Faixa só do wireframe: troca o perfil simulado e restaura os dados. Sai na implementação real. */
export function WireframeBar() {
  const { role, setRole, reset } = useHubMock();
  const roles: { value: ViewerRole; label: string }[] = [
    { value: 'colaborador', label: 'Colaborador' },
    { value: 'publicador', label: 'Publicador' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-dashed border-amber-400/80 bg-amber-50/80 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <FlaskConical className="h-3.5 w-3.5" /> Wireframe
      </span>
      <span className="hidden sm:inline">dados fictícios, nada é gravado</span>
      <span className="inline-flex items-center gap-1.5">
        Ver como
        <span className="inline-flex rounded-md border border-amber-300 bg-white p-0.5 dark:border-amber-800 dark:bg-transparent" role="group" aria-label="Perfil simulado">
          {roles.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              aria-pressed={role === r.value}
              className={cn('rounded px-2 py-0.5', role === r.value ? 'bg-amber-500 font-semibold text-white' : 'hover:bg-amber-100 dark:hover:bg-amber-900')}
            >
              {r.label}
            </button>
          ))}
        </span>
      </span>
      <button type="button" onClick={reset} className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-amber-100 dark:hover:bg-amber-900">
        <RotateCcw className="h-3 w-3" /> Restaurar dados
      </button>
    </div>
  );
}
