"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useHubModules } from '@/hooks/useHubModules';
import { canAccessEmbeddedModule } from '@/components/layout/navigation';
import { findEmbeddedModuleBySlug, type EmbeddedHubModule } from '@/config/modules';

export type EmbeddedModuleRouteState =
  | { status: 'loading'; module?: undefined }
  | { status: 'not-found'; module?: undefined }
  | { status: 'forbidden'; module: EmbeddedHubModule }
  | { status: 'ok'; module: EmbeddedHubModule };

/**
 * Resolve `/{slug}` para um módulo embarcado do registro e diz se o usuário pode abri-lo.
 * Enquanto o registro ainda não chegou do Firestore, não decide nada — assim um módulo
 * novo (que não existe no seed) não cai em 404 durante o carregamento.
 */
export function useEmbeddedModuleRoute(slug: string | undefined): EmbeddedModuleRouteState {
  const { modules, loading: modulesLoading, isFallback } = useHubModules();
  const { loading: authLoading, permissions, currentUserCollab, isSuperAdmin } = useAuth();

  if (authLoading || (modulesLoading && isFallback)) return { status: 'loading' };

  const mod = slug ? findEmbeddedModuleBySlug(modules, slug) : undefined;
  if (!mod || !mod.enabled) return { status: 'not-found' };

  const allowed = canAccessEmbeddedModule(mod, {
    permissions,
    modulePermissions: currentUserCollab?.modulePermissions,
    isSuperAdmin,
  });
  return allowed ? { status: 'ok', module: mod } : { status: 'forbidden', module: mod };
}
