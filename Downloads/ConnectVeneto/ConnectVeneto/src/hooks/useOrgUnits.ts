"use client";

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { normalizeEmail } from '@/lib/email-utils';
import type { OrgUnit, UnitType } from '@/lib/hub/org-units';

export const ORG_UNITS_KEY = ['org-units'] as const;

/** Estrutura organizacional (ADR 0004), lida pelo servidor (`/api/org/units`). */
export function useOrgUnits() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ORG_UNITS_KEY,
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<OrgUnit[]> => {
      const token = await user?.getIdToken();
      const res = await fetch('/api/org/units', { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
      if (!res.ok) return [];
      const body = await res.json().catch(() => ({}));
      return Array.isArray(body.units) ? body.units : [];
    },
  });
  const units = useMemo(() => query.data ?? [], [query.data]);
  const byId = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  return { units, byId, loading: query.isLoading };
}

/** Quem edita a estrutura: o RH (admin do cadastro de colaboradores) e os super admins. */
export function useCanEditStructure(): boolean {
  const { user, isSuperAdmin } = useAuth();
  const { settings } = useSystemSettings();
  const email = normalizeEmail(user?.email);
  return isSuperAdmin || (!!email && (settings.collaboratorAdminEmails ?? []).some((e) => normalizeEmail(e) === email));
}

/** Ações de edição da estrutura e de encaixe de pessoas (rotas do RH, Admin SDK). */
export function useOrgUnitActions() {
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
    () => Promise.all([queryClient.invalidateQueries({ queryKey: ORG_UNITS_KEY }), queryClient.invalidateQueries({ queryKey: ['collaborators'] })]),
    [queryClient],
  );

  return {
    createUnit: async (u: { name: string; type: UnitType; parentId: string | null; leaderIdVeneto: string | null }) => {
      const r = await call('/api/admin/org-units', 'POST', u);
      await refresh();
      return r.id as string;
    },
    updateUnit: async (id: string, patch: Partial<Omit<OrgUnit, 'id'>>) => {
      await call('/api/admin/org-units', 'PATCH', { id, ...patch });
      await refresh();
    },
    deleteUnit: async (id: string) => {
      await call('/api/admin/org-units', 'DELETE', { id });
      await refresh();
    },
    /** Encaixa a pessoa numa unidade (ou tira, com ''). */
    setPersonUnit: async (collaboratorId: string, unitId: string) => {
      await call(`/api/admin/collaborators?id=${encodeURIComponent(collaboratorId)}`, 'PATCH', { unitId });
      await refresh();
    },
    /** Gestor fora da regra da estrutura ('' remove a exceção). */
    setManagerOverride: async (collaboratorId: string, managerIdVeneto: string) => {
      await call(`/api/admin/collaborators?id=${encodeURIComponent(collaboratorId)}`, 'PATCH', { managerOverrideIdVeneto: managerIdVeneto });
      await refresh();
    },
  };
}
