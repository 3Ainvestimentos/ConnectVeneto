"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useHubPilotAccess } from '@/hooks/useHubPilotAccess';

/**
 * Páginas do Hub de Comunicação abrem para quem tem acesso ao módulo `inicio` (aberto a todos desde 2026-10-23; acesso
 * revogável por pessoa) ou super admin. A API já barra no servidor; isto evita a página vazia/mock para
 * quem chega pelo endereço.
 */
export function HubPilotGate({ children }: { children: React.ReactNode }) {
  const { allowed, loading } = useHubPilotAccess();
  const router = useRouter();
  // Sem acesso (revogado), vai direto para o Painel Inicial, sem aviso.
  useEffect(() => {
    if (!loading && !allowed) router.replace('/dashboard');
  }, [loading, allowed, router]);

  if (loading || !allowed) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return <>{children}</>;
}

/** Selo para blocos que ainda mostram dados de exemplo durante o piloto. */
export function ExampleDataBadge() {
  return (
    <span
      title="Este bloco ainda mostra dados de exemplo. Os dados reais entram numa próxima etapa."
      className="rounded-full border border-dashed border-amber-400 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
    >
      dados de exemplo
    </span>
  );
}
