'use client';

import { useEffect } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import EmbeddedModulePage from '@/components/embeds/EmbeddedModulePage';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useEmbeddedModuleRoute } from '@/hooks/useEmbeddedModuleRoute';

/**
 * Página de qualquer módulo embarcado cadastrado em `hubModules` (aba Módulos do /admin).
 * Rotas estáticas do app (ex.: /dashboard, /admin) têm precedência sobre este segmento.
 */
export default function EmbeddedModuleRoutePage() {
  const { moduleSlug } = useParams<{ moduleSlug: string }>();
  const router = useRouter();
  const state = useEmbeddedModuleRoute(moduleSlug);

  useEffect(() => {
    if (state.status === 'forbidden') router.replace('/dashboard');
  }, [state.status, router]);

  if (state.status === 'not-found') notFound();

  if (state.status !== 'ok') {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] w-full items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <WidgetErrorBoundary title={`${state.module.label} indisponível`}>
      <EmbeddedModulePage module={state.module} />
    </WidgetErrorBoundary>
  );
}
