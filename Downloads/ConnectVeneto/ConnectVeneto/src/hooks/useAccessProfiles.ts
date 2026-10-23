"use client";

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { AccessOverrides, AccessProfile } from '@/lib/access/profiles';
import { ORG_UNITS_KEY } from './useOrgUnits';

export const ACCESS_PROFILES_KEY = ['access-profiles'] as const;

/** Perfis de acesso (ADR 0005), lidos pelo servidor. RH e super admin. */
export function useAccessProfiles(enabled = true) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ACCESS_PROFILES_KEY,
    enabled: !!user && enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<AccessProfile[]> => {
      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/access/profiles', { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
      if (!res.ok) return [];
      const body = await res.json().catch(() => ({}));
      return Array.isArray(body.profiles) ? body.profiles : [];
    },
  });
  return { profiles: query.data ?? [], loading: query.isLoading };
}

export type ProfileInput = Omit<AccessProfile, 'id'>;

/** Criar/editar perfis (super admin) e atribuir perfil/ajustes a pessoas e unidades (RH). */
export function useAccessActions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const call = useCallback(
    async (url: string, method: string, body: unknown) => {
      const token = await user?.getIdToken();
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'Não foi possível salvar.');
      return payload;
    },
    [user],
  );

  const refresh = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ACCESS_PROFILES_KEY }),
        queryClient.invalidateQueries({ queryKey: ORG_UNITS_KEY }),
        queryClient.invalidateQueries({ queryKey: ['collaborators'] }),
      ]),
    [queryClient],
  );

  return {
    createProfile: async (p: ProfileInput) => {
      const r = await call('/api/admin/access/profiles', 'POST', p);
      await refresh();
      return r.id as string;
    },
    updateProfile: async (id: string, p: Partial<ProfileInput>) => {
      const r = await call('/api/admin/access/profiles', 'PATCH', { id, ...p });
      await refresh();
      return (r.changed as number) ?? 0;
    },
    deleteProfile: async (id: string) => {
      await call('/api/admin/access/profiles', 'DELETE', { id });
      await refresh();
    },
    /** Acesso direto (permissões e módulos) ou perfil próprio e ajustes (ADR 0005). */
    setPersonAccess: async (
      collaboratorId: string,
      body: {
        permissions?: Partial<Record<string, boolean>>;
        modulePermissions?: Record<string, string[] | null>;
        accessProfileId?: string | null;
        accessOverrides?: AccessOverrides | null;
      },
    ) => {
      await call(`/api/admin/access/people?id=${encodeURIComponent(collaboratorId)}`, 'PATCH', body);
      await refresh();
    },
    setUnitProfile: async (unitId: string, accessProfileId: string | null) => {
      await call('/api/admin/org-units', 'PATCH', { id: unitId, accessProfileId });
      await refresh();
    },
  };
}
