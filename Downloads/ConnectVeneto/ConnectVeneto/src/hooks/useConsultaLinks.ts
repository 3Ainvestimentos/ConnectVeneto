"use client";

import { getAuth } from 'firebase/auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getFirebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type {
  Audience,
  ConsultaLinksSession,
  ConsultaLinkType,
  TypeAdminData,
} from '@/config/consulta-links';

export type LinkDraft = { title: string; url: string; description: string };
export type TypedLinkDraft = {
  kind: 'individual' | 'shared';
  title: string;
  description: string;
  /** Só no Compartilhado — Individual aparece só para quem tem URL cadastrada. */
  url?: string;
  audience?: Audience;
};
export type LinkTypeDraft = Pick<ConsultaLinkType, 'name' | 'description' | 'adminEmails' | 'adminAreas' | 'order'>;

/** Chamada autenticada às rotas de `/api/consulta` (as coleções são fechadas nas rules). */
async function consultaRequest<T>(url: string, init: { method: string; body?: unknown } = { method: 'GET' }): Promise<T> {
  const currentUser = getAuth(getFirebaseApp()).currentUser;
  if (!currentUser) throw new Error('Sessão expirada. Entre novamente para continuar.');

  const token = await currentUser.getIdToken();
  const response = await fetch(url, {
    method: init.method,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });

  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(payload?.error ?? 'Não foi possível concluir a operação.');
  return payload as T;
}

const SESSION_KEY = ['consulta-links', 'me'] as const;
const adminKey = (typeId: string) => ['consulta-links', 'admin', typeId] as const;
const q = encodeURIComponent;

/** Links que a pessoa logada vê + tipos existentes e quais ela administra. */
export function useConsultaSession() {
  const { user } = useAuth();
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => consultaRequest<ConsultaLinksSession>('/api/consulta/links'),
    enabled: !!user,
    staleTime: 60_000,
  });
}

/** Links de um tipo, URLs individuais e Público de cada link — só para quem administra o tipo. */
export function useTypeAdmin(typeId: string | null) {
  return useQuery({
    queryKey: adminKey(typeId ?? ''),
    queryFn: () => consultaRequest<TypeAdminData>(`/api/consulta/admin/links?typeId=${q(typeId as string)}`),
    enabled: !!typeId,
  });
}

export function useConsultaMutations() {
  const queryClient = useQueryClient();
  const withInvalidate = { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consulta-links'] }) };

  return {
    createLink: useMutation({
      mutationFn: (input: LinkDraft) => consultaRequest('/api/consulta/links', { method: 'POST', body: input }),
      ...withInvalidate,
    }),
    updateLink: useMutation({
      mutationFn: ({ id, ...fields }: LinkDraft & { id: string }) =>
        consultaRequest(`/api/consulta/links?id=${q(id)}`, { method: 'PATCH', body: fields }),
      ...withInvalidate,
    }),
    deleteLink: useMutation({
      mutationFn: (id: string) => consultaRequest(`/api/consulta/links?id=${q(id)}`, { method: 'DELETE' }),
      ...withInvalidate,
    }),
    saveTypedLink: useMutation({
      mutationFn: ({ id, typeId, draft }: { id?: string; typeId: string; draft: TypedLinkDraft }) => {
        if (!id) return consultaRequest('/api/consulta/admin/links', { method: 'POST', body: { typeId, ...draft } });
        const { kind, url, audience, ...fields } = draft;
        return consultaRequest(`/api/consulta/admin/links?id=${q(id)}`, {
          method: 'PATCH',
          body: kind === 'shared' ? { ...fields, url, audience } : fields,
        });
      },
      ...withInvalidate,
    }),
    deleteTypedLink: useMutation({
      mutationFn: (id: string) => consultaRequest(`/api/consulta/admin/links?id=${q(id)}`, { method: 'DELETE' }),
      ...withInvalidate,
    }),
    saveValue: useMutation({
      mutationFn: (input: { linkId: string; ownerEmail: string; url: string }) =>
        consultaRequest('/api/consulta/admin/values', { method: 'PUT', body: input }),
      ...withInvalidate,
    }),
    deleteValue: useMutation({
      mutationFn: ({ linkId, ownerEmail }: { linkId: string; ownerEmail: string }) =>
        consultaRequest(`/api/consulta/admin/values?linkId=${q(linkId)}&ownerEmail=${q(ownerEmail)}`, { method: 'DELETE' }),
      ...withInvalidate,
    }),
    saveType: useMutation({
      mutationFn: ({ id, ...fields }: LinkTypeDraft & { id?: string }) =>
        id
          ? consultaRequest(`/api/consulta/types?id=${q(id)}`, { method: 'PATCH', body: fields })
          : consultaRequest('/api/consulta/types', { method: 'POST', body: fields }),
      ...withInvalidate,
    }),
    deleteType: useMutation({
      mutationFn: (id: string) => consultaRequest(`/api/consulta/types?id=${q(id)}`, { method: 'DELETE' }),
      ...withInvalidate,
    }),
  };
}
