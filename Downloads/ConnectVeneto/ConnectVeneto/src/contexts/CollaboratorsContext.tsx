
"use client";

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { addDocumentToCollection, updateDocumentInCollection, deleteDocumentFromCollection, WithId, addMultipleDocumentsToCollection, listenToCollection, getCollection } from '@/lib/firestore-service';
import { useAuth } from './AuthContext';
import { useSystemSettings } from './SystemSettingsContext';

export interface CollaboratorPermissions {
  canManageWorkflows: boolean;
  canManageRequests: boolean;
  canManageContent: boolean;
  canManageTripsBirthdays: boolean;
  canManageVacation: boolean;
  canViewAudit: boolean;
  canManageSystem: boolean;
  canViewConsultaPessoal: boolean;
  canViewDocuments: boolean;
  canViewApplications: boolean;
  canViewRegrasComerciais: boolean;
  canViewTasks: boolean;
  canViewBI: boolean;
  canViewCRM: boolean;
  canViewStrategicPanel: boolean;
  canViewOpportunityMap: boolean;
  canViewMeetAnalyses: boolean;
  canViewDirectoria: boolean;
}

export interface ConsultaLinks {
  mesa: string;
  cliente: string;
  cx: string;
}

export interface Collaborator {
  id: string;
  idVeneto: string; // Identificador principal
  name: string;
  email: string;
  photoURL?: string; // Link da imagem do colaborador
  axis: string;      // Eixo
  area: string;      // Área
  position: string;  // Cargo
  segment: string;   // Segmento
  leader: string;    // Nome do líder direto (como na planilha RH)
  lideranca?: string; // Ex.: SIM / NÃO — integra grupo de liderança
  city: string;      // Cidade
  permissions: CollaboratorPermissions;
  googleDriveLinks?: string[];
  consultaLinks?: ConsultaLinks;
  acceptedTermsVersion?: number; // Versão dos termos aceitos pelo usuário
  createdAt?: string; // ISO String for creation timestamp
  authUid?: string; // Firebase Auth UID
}

export const getCollaboratorUserId = (collaborator: Partial<Collaborator> | null | undefined): string | null => {
  if (!collaborator) return null;
  return collaborator.idVeneto || null;
};

interface CollaboratorsContextType {
  collaborators: Collaborator[];
  loading: boolean;
  addCollaborator: (collaborator: Omit<Collaborator, 'id'>) => Promise<WithId<Omit<Collaborator, 'id'>>>;
  addMultipleCollaborators: (collaborators: Omit<Collaborator, 'id'>[]) => Promise<void>;
  updateCollaborator: (currentData: Collaborator, newData: Omit<Collaborator, 'id'>) => Promise<void>;
  updateCollaboratorPermissions: (id: string, permissions: CollaboratorPermissions) => Promise<void>;
  deleteCollaboratorMutation: UseMutationResult<void, Error, string, unknown>;
}

const CollaboratorsContext = createContext<CollaboratorsContextType | undefined>(undefined);
const COLLECTION_NAME = 'collaborators';
const LOG_COLLECTION_NAME = 'collaborator_logs';

const defaultPermissions: CollaboratorPermissions = {
  canManageWorkflows: false,
  canManageRequests: false,
  canManageContent: false,
  canManageTripsBirthdays: false,
  canManageVacation: false,
  canViewAudit: false,
  canManageSystem: false,
  canViewConsultaPessoal: false,
  canViewDocuments: true,
  canViewApplications: true,
  canViewRegrasComerciais: true,
  canViewTasks: false,
  canViewBI: false,
  canViewCRM: false,
  canViewStrategicPanel: false,
  canViewOpportunityMap: false,
  canViewMeetAnalyses: false,
  canViewDirectoria: false,
};

export const CollaboratorsProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { settings, updateSystemSettings } = useSystemSettings();

  const { data: collaborators = [], isFetching } = useQuery<Collaborator[]>({
    queryKey: [COLLECTION_NAME],
    queryFn: () => getCollection<Collaborator>(COLLECTION_NAME),
    staleTime: Infinity,
    enabled: !!user,
    select: (data) => data.map(c => ({
        ...c,
        permissions: { ...defaultPermissions, ...c.permissions }
    }))
  });
  
  React.useEffect(() => {
    if (!user) return; 
    const unsubscribe = listenToCollection<Collaborator>(
      COLLECTION_NAME,
      (newData) => {
        queryClient.setQueryData([COLLECTION_NAME], newData);
      },
      (error) => {
        console.error("Failed to listen to collaborators collection:", error);
      }
    );
    return () => unsubscribe();
  }, [queryClient, user]);

  const addCollaboratorMutation = useMutation<WithId<Omit<Collaborator, 'id'>>, Error, Omit<Collaborator, 'id'>>({
    mutationFn: async (collaboratorData: Omit<Collaborator, 'id'>) => {
        const newCollaborator = await addDocumentToCollection(COLLECTION_NAME, { ...collaboratorData, createdAt: new Date().toISOString() });
        await updateSystemSettings({ collaboratorTableVersion: (settings.collaboratorTableVersion || 1) + 1 });
        return newCollaborator;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
    },
  });

  const addMultipleCollaboratorsMutation = useMutation<void, Error, Omit<Collaborator, 'id'>[]>({
    mutationFn: async (collaboratorsData: Omit<Collaborator, 'id'>[]) => {
        const dataWithTimestamp = collaboratorsData.map(c => ({ ...c, createdAt: new Date().toISOString() }));
        await addMultipleDocumentsToCollection(COLLECTION_NAME, dataWithTimestamp);
        await updateSystemSettings({ collaboratorTableVersion: (settings.collaboratorTableVersion || 1) + 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
    },
  });

  const updateCollaboratorMutation = useMutation<void, Error, { currentData: Collaborator, newData: Omit<Collaborator, 'id'> }>({
    mutationFn: async ({ currentData, newData }) => {
        const { id, ...originalData } = currentData;
        const changes: Array<{
          field: keyof Omit<Collaborator, 'id'>;
          oldValue: unknown;
          newValue: unknown;
        }> = [];
        
        for (const key in newData) {
            const typedKey = key as keyof typeof newData;
            if (JSON.stringify(originalData[typedKey]) !== JSON.stringify(newData[typedKey])) {
                changes.push({
                    field: typedKey,
                    oldValue: originalData[typedKey],
                    newValue: newData[typedKey]
                });
            }
        }
        
        if (changes.length > 0) {
            const logEntry = {
                collaboratorId: id,
                collaboratorName: newData.name,
                updatedBy: user?.displayName || 'Sistema',
                updatedAt: new Date().toISOString(),
                changes: changes
            };
            await addDocumentToCollection(LOG_COLLECTION_NAME, logEntry);
            await updateDocumentInCollection(COLLECTION_NAME, id, newData);
        }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
      queryClient.invalidateQueries({ queryKey: [LOG_COLLECTION_NAME] });
    },
  });

  const updateCollaboratorPermissionsMutation = useMutation<void, Error, { id: string; permissions: CollaboratorPermissions }>({
    mutationFn: async ({ id, permissions }) => {
        const currentCollaborator = collaborators.find(c => c.id === id);
        if (!currentCollaborator) throw new Error("Colaborador não encontrado");
        
        const logEntry = {
            collaboratorId: id,
            collaboratorName: currentCollaborator.name,
            updatedBy: user?.displayName || 'Sistema',
            updatedAt: new Date().toISOString(),
            changes: [{
                field: 'permissions',
                oldValue: currentCollaborator.permissions,
                newValue: permissions,
            }]
        };
        await addDocumentToCollection(LOG_COLLECTION_NAME, logEntry);
        await updateDocumentInCollection(COLLECTION_NAME, id, { permissions });
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
        queryClient.invalidateQueries({ queryKey: [LOG_COLLECTION_NAME] });
    },
  });

  const deleteCollaboratorMutation = useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
        await deleteDocumentFromCollection(COLLECTION_NAME, id);
        await updateSystemSettings({ collaboratorTableVersion: (settings.collaboratorTableVersion || 1) + 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
    },
  });

  const value = useMemo(() => ({
    collaborators,
    loading: isFetching,
    addCollaborator: (collaborator: Omit<Collaborator, 'id'>) => addCollaboratorMutation.mutateAsync(collaborator),
    addMultipleCollaborators: (collaborators: Omit<Collaborator, 'id'>[]) => addMultipleCollaboratorsMutation.mutateAsync(collaborators),
    updateCollaborator: (currentData: Collaborator, newData: Omit<Collaborator, 'id'>) => updateCollaboratorMutation.mutateAsync({ currentData, newData }),
    updateCollaboratorPermissions: (id: string, permissions: CollaboratorPermissions) => updateCollaboratorPermissionsMutation.mutateAsync({ id, permissions }),
    deleteCollaboratorMutation,
  }), [collaborators, isFetching, addCollaboratorMutation, addMultipleCollaboratorsMutation, updateCollaboratorMutation, updateCollaboratorPermissionsMutation, deleteCollaboratorMutation]);

  return (
    <CollaboratorsContext.Provider value={value}>
      {children}
    </CollaboratorsContext.Provider>
  );
};

export const useCollaborators = (): CollaboratorsContextType => {
  const context = useContext(CollaboratorsContext);
  if (context === undefined) {
    throw new Error('useCollaborators must be used within a CollaboratorsProvider');
  }
  return context;
};
