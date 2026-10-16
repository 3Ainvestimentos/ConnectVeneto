"use client";

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { resolveModuleAccess } from '@/config/modules';
import { useHubModules } from '@/hooks/useHubModules';
import { findCollaboratorByEmail } from '@/lib/email-utils';
import { HUB_PILOT_MODULE_ID } from '@/lib/hub/model';

/**
 * A pessoa está no piloto da nova Home? (módulo interno `inicio` com acesso explícito, ou super
 * admin). Mesma regra do servidor (`requireHubPilotViewer`); aqui serve só para a interface.
 */
export function useHubPilotAccess(): { allowed: boolean; loading: boolean } {
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

  return { allowed, loading: authLoading || collabLoading || modulesLoading };
}
