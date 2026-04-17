
"use client";

import React, { createContext, useContext, ReactNode, useMemo, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDocument, setDocumentInCollection } from '@/lib/firestore-service';
import { normalizeEmail } from '@/lib/email-utils';
import { getFirebaseApp } from '@/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

export interface SystemSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowedUserIds: string[];
  termsUrl: string;
  termsVersion: number;
  privacyPolicyUrl: string;
  privacyPolicyVersion: number;
  superAdminEmails: string[];
  /** E-mails que podem importar / criar colaboradores em lote (regra Firestore `isCollaboratorImporter`). */
  collaboratorAdminEmails: string[];
  collaboratorTableVersion: number;
  isRssNewsletterActive?: boolean;
  rssNewsletterUrl?: string;
  loginFrequencyGoal?: number; // Meta de logins por mês por usuário (ex: 12 logins/mês)
}

interface SystemSettingsContextType {
  settings: SystemSettings;
  loading: boolean;
  updateSystemSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;
}

const SystemSettingsContext = createContext<SystemSettingsContextType | undefined>(undefined);

const COLLECTION_NAME = 'systemSettings';
const PRIVATE_DOC_ID = 'config';
const PUBLIC_DOC_ID = 'public_config';
const SETTINGS_QUERY_SCOPE = 'resolved';

const defaultSettings: SystemSettings = {
    maintenanceMode: false,
    maintenanceMessage: 'A plataforma está temporariamente indisponível para manutenção. Voltaremos em breve.',
    allowedUserIds: [],
    termsUrl: '',
    termsVersion: 1,
    privacyPolicyUrl: '',
    privacyPolicyVersion: 1,
    superAdminEmails: [],
    collaboratorAdminEmails: [],
    collaboratorTableVersion: 1,
    isRssNewsletterActive: false,
    rssNewsletterUrl: '',
    loginFrequencyGoal: 12, // Meta padrão: 12 logins/mês por usuário
};

type PublicSystemSettings = Pick<SystemSettings, 'maintenanceMode' | 'maintenanceMessage'>;

const normalizeBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const normalizeString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const normalizeNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const normalizeStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const normalizeEmailList = (value: unknown): string[] =>
  normalizeStringList(value)
    .map((email) => normalizeEmail(email))
    .filter((email): email is string => email !== null);

const stripDocumentId = (
  doc: ({ id: string } & Partial<SystemSettings>) | null,
): Partial<SystemSettings> | null => {
  if (!doc) return null;
  const { id: _id, ...rest } = doc;
  return rest;
};

const normalizePublicSettings = (source: Partial<SystemSettings> | null): PublicSystemSettings => ({
  maintenanceMode: normalizeBoolean(source?.maintenanceMode, defaultSettings.maintenanceMode),
  maintenanceMessage: normalizeString(source?.maintenanceMessage, defaultSettings.maintenanceMessage),
});

const normalizePrivateSettings = (source: Partial<SystemSettings> | null): SystemSettings => {
  const merged = { ...defaultSettings, ...(source ?? {}) };
  const superNorm = normalizeEmailList(merged.superAdminEmails);
  return {
    ...defaultSettings,
    ...merged,
    maintenanceMode: normalizeBoolean(merged.maintenanceMode, defaultSettings.maintenanceMode),
    maintenanceMessage: normalizeString(merged.maintenanceMessage, defaultSettings.maintenanceMessage),
    allowedUserIds: normalizeStringList(merged.allowedUserIds),
    termsUrl: normalizeString(merged.termsUrl, defaultSettings.termsUrl),
    termsVersion: normalizeNumber(merged.termsVersion, defaultSettings.termsVersion),
    privacyPolicyUrl: normalizeString(merged.privacyPolicyUrl, defaultSettings.privacyPolicyUrl),
    privacyPolicyVersion: normalizeNumber(merged.privacyPolicyVersion, defaultSettings.privacyPolicyVersion),
    superAdminEmails: superNorm,
    collaboratorAdminEmails: normalizeEmailList(merged.collaboratorAdminEmails),
    collaboratorTableVersion: normalizeNumber(merged.collaboratorTableVersion, defaultSettings.collaboratorTableVersion),
    isRssNewsletterActive: normalizeBoolean(merged.isRssNewsletterActive, defaultSettings.isRssNewsletterActive ?? false),
    rssNewsletterUrl: normalizeString(merged.rssNewsletterUrl, defaultSettings.rssNewsletterUrl ?? ''),
    loginFrequencyGoal: normalizeNumber(merged.loginFrequencyGoal, defaultSettings.loginFrequencyGoal ?? 12),
  };
};

const getSettingsQueryKey = (authUid: string | null) =>
  [COLLECTION_NAME, SETTINGS_QUERY_SCOPE, authUid ?? 'anonymous'] as const;

const fetchPublicSystemSettings = async (): Promise<SystemSettings> => {
  const rawDoc = await getDocument<Partial<SystemSettings>>(COLLECTION_NAME, PUBLIC_DOC_ID);
  const publicData = normalizePublicSettings(stripDocumentId(rawDoc));
  return {
    ...defaultSettings,
    ...publicData,
  };
};

/**
 * Bloco 7 Phase B: client nao le `systemSettings/config` direto do Firestore.
 * Em vez disso, busca via `/api/me/session` (com `requireCorporateUser` no server),
 * que nunca retorna `superAdminEmails` nem `collaboratorAdminEmails`.
 *
 * Super admins, adicionalmente, buscam `/api/admin/settings` para os campos
 * sensiveis, protegidos por `requireSuperAdmin`.
 *
 * Assim, o browser de um usuario comum nunca recebe a lista de super admins.
 */
async function fetchSessionOrNull(): Promise<
  (Partial<SystemSettings> & { isSuperAdmin?: boolean }) | null
> {
  if (typeof window === 'undefined') return null;
  const user = getAuth(getFirebaseApp()).currentUser;
  if (!user) return null;

  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/me/session', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as Partial<SystemSettings> & { isSuperAdmin?: boolean };
  } catch {
    return null;
  }
}

async function fetchAdminSettingsOrNull(): Promise<Partial<SystemSettings> | null> {
  if (typeof window === 'undefined') return null;
  const user = getAuth(getFirebaseApp()).currentUser;
  if (!user) return null;

  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/admin/settings', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as Partial<SystemSettings>;
  } catch {
    return null;
  }
}

export const fetchPrivateSystemSettings = async (): Promise<SystemSettings> => {
  const session = await fetchSessionOrNull();
  if (!session) {
    // Usuario nao autenticado, token indisponivel ou endpoint fora do ar.
    // Retorna defaults (nao expoe nada sensivel).
    return defaultSettings;
  }

  let adminFields: Partial<SystemSettings> | null = null;
  if (session.isSuperAdmin) {
    adminFields = await fetchAdminSettingsOrNull();
  }

  return normalizePrivateSettings({
    ...session,
    ...(adminFields ?? {}),
  } as Partial<SystemSettings>);
};

const extractPublicPatch = (patch: Partial<SystemSettings>): Partial<PublicSystemSettings> => {
  const publicPatch: Partial<PublicSystemSettings> = {};
  if (typeof patch.maintenanceMode === 'boolean') {
    publicPatch.maintenanceMode = patch.maintenanceMode;
  }
  if (typeof patch.maintenanceMessage === 'string') {
    publicPatch.maintenanceMessage = patch.maintenanceMessage;
  }
  return publicPatch;
};

export const SystemSettingsProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUid(user?.uid ?? null);
      setAuthResolved(true);
    });
    return () => unsubscribe();
  }, []);

  const currentSettingsKey = getSettingsQueryKey(authUid);

  const { data: settings = defaultSettings, isFetching } = useQuery<SystemSettings>({
    queryKey: currentSettingsKey,
    enabled: authResolved,
    queryFn: async () => {
      return authUid ? fetchPrivateSystemSettings() : fetchPublicSystemSettings();
    },
    staleTime: 5 * 60 * 1000,
  });

  const updateSettingsMutation = useMutation<Partial<SystemSettings>, Error, Partial<SystemSettings>>({
    mutationFn: async (newSettings) => {
      const patch: Partial<SystemSettings> = { ...newSettings };
      if (patch.superAdminEmails != null) {
        patch.superAdminEmails = patch.superAdminEmails
          .map((e) => normalizeEmail(e))
          .filter((e): e is string => e !== null);
      }
      if (patch.collaboratorAdminEmails != null) {
        patch.collaboratorAdminEmails = patch.collaboratorAdminEmails
          .map((e) => normalizeEmail(e))
          .filter((e): e is string => e !== null);
      }
      await setDocumentInCollection(COLLECTION_NAME, PRIVATE_DOC_ID, patch);
      const publicPatch = extractPublicPatch(patch);
      if (Object.keys(publicPatch).length > 0) {
        await setDocumentInCollection(COLLECTION_NAME, PUBLIC_DOC_ID, publicPatch);
      }
      return patch;
    },
    onSuccess: (appliedPatch) => {
      queryClient.setQueryData(currentSettingsKey, (old: SystemSettings | undefined) =>
        normalizePrivateSettings({
          ...(old || defaultSettings),
          ...appliedPatch,
        }),
      );

      const publicPatch = extractPublicPatch(appliedPatch);
      if (Object.keys(publicPatch).length > 0) {
        queryClient.setQueryData(getSettingsQueryKey(null), (old: SystemSettings | undefined) => {
          const anonymousBase = old || defaultSettings;
          const nextPublic = normalizePublicSettings({
            ...anonymousBase,
            ...publicPatch,
          });
          return {
            ...anonymousBase,
            ...nextPublic,
          };
        });
      }
    },
  });

  const value = useMemo(() => ({
    settings,
    loading: !authResolved || isFetching,
    updateSystemSettings: async (newSettings: Partial<SystemSettings>) => {
      await updateSettingsMutation.mutateAsync(newSettings);
    },
  }), [settings, authResolved, isFetching, updateSettingsMutation]);

  return (
    <SystemSettingsContext.Provider value={value}>
      {children}
    </SystemSettingsContext.Provider>
  );
};

export const useSystemSettings = (): SystemSettingsContextType => {
  const context = useContext(SystemSettingsContext);
  if (context === undefined) {
    throw new Error('useSystemSettings must be used within a SystemSettingsProvider');
  }
  return context;
};
