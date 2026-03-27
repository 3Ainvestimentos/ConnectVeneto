
"use client";

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDocument, setDocumentInCollection } from '@/lib/firestore-service';

export interface SystemSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowedUserIds: string[];
  termsUrl: string;
  termsVersion: number;
  privacyPolicyUrl: string;
  privacyPolicyVersion: number;
  superAdminEmails: string[];
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
const DOC_ID = 'config'; // Use a single document for all settings

const defaultSettings: SystemSettings = {
    maintenanceMode: false,
    maintenanceMessage: 'A plataforma está temporariamente indisponível para manutenção. Voltaremos em breve.',
    allowedUserIds: [],
    termsUrl: '',
    termsVersion: 1,
    privacyPolicyUrl: '',
    privacyPolicyVersion: 1,
    superAdminEmails: ['desenvolvedor@venetomfo.com.br'],
    collaboratorTableVersion: 1,
    isRssNewsletterActive: false,
    rssNewsletterUrl: '',
    loginFrequencyGoal: 12, // Meta padrão: 12 logins/mês por usuário
};

export const SystemSettingsProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();

  const { data: settings = defaultSettings, isFetching } = useQuery<SystemSettings>({
    queryKey: [COLLECTION_NAME, DOC_ID],
    queryFn: async () => {
      const doc = await getDocument<SystemSettings>(COLLECTION_NAME, DOC_ID);
      return doc ? { ...defaultSettings, ...doc } : defaultSettings;
    },
    staleTime: 5 * 60 * 1000,
  });

  const updateSettingsMutation = useMutation<void, Error, Partial<SystemSettings>>({
    mutationFn: (newSettings) => setDocumentInCollection(COLLECTION_NAME, DOC_ID, newSettings),
    onSuccess: (data, variables) => {
        queryClient.setQueryData([COLLECTION_NAME, DOC_ID], (old: SystemSettings | undefined) => ({
            ...(old || defaultSettings),
            ...variables,
        }));
    },
  });

  const value = useMemo(() => ({
    settings,
    loading: isFetching,
    updateSystemSettings: (newSettings: Partial<SystemSettings>) => updateSettingsMutation.mutateAsync(newSettings),
  }), [settings, isFetching, updateSettingsMutation]);

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
