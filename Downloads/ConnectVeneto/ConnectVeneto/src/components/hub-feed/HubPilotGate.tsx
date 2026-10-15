"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { resolveModuleAccess } from '@/config/modules';
import { useHubModules } from '@/hooks/useHubModules';
import { findCollaboratorByEmail } from '@/lib/email-utils';
import { HUB_PILOT_MODULE_ID } from '@/lib/hub/model';

/**
 * Páginas do Hub de Comunicação só abrem para quem está no piloto (módulo `inicio`, acesso
 * explícito) ou super admin. A API já barra no servidor; isto evita a página vazia/mock para
 * quem chega pelo endereço.
 */
export function HubPilotGate({ children }: { children: React.ReactNode }) {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const { collaborators, loading: collabLoading } = useCollaborators();
  const { modules, loading: modulesLoading } = useHubModules();

  const allowed = useMemo(() => {
    if (isSuperAdmin) return true;
    const mod = modules.find((m) => m.id === HUB_PILOT_MODULE_ID);
    if (!mod || !mod.enabled) return false;
    const collab = user ? findCollaboratorByEmail(collaborators, user.email) : null;
    return resolveModuleAccess(mod, collab?.modulePermissions?.[mod.id]).hasAccess;
  }, [isSuperAdmin, modules, user, collaborators]);

  if (authLoading || collabLoading || modulesLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto my-16 grid max-w-lg justify-items-center gap-3 rounded-xl border bg-card p-10 text-center">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <h1 className="font-headline text-xl font-semibold">A nova Home está em piloto</h1>
        <p className="text-muted-foreground">Ela ainda não foi liberada para você. Enquanto isso, o Painel Inicial continua igual.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Ir para o Painel Inicial</Link>
        </Button>
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
