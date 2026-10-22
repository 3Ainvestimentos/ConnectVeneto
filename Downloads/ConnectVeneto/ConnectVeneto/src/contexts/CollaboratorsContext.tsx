
"use client";

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { getAuth } from 'firebase/auth';
import { useQuery, useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { getFirebaseApp } from '@/lib/firebase';
import { addDocumentToCollection, WithId, addMultipleDocumentsToCollection, listenToCollection, getCollection } from '@/lib/firestore-service';
import { useAuth } from './AuthContext';
import { DEFAULT_PERMISSIONS } from '@/lib/access/catalog';
import type { AccessOverrides } from '@/lib/access/profiles';

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
  /** Edita a apresentação (carrossel) do Mix de Serviços em /regras-comerciais. */
  canManageRegrasComerciais: boolean;
  /** Vê a aba "Comercial" da biblioteca de documentos (chat de IA + acervo comercial). */
  canViewBibliotecaComercial: boolean;
  /** Sobe, edita e exclui documentos da Biblioteca Comercial. */
  canManageBibliotecaComercial: boolean;
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
  acceptedTermsVersion?: number; // Versão dos termos aceitos pelo usuário
  createdAt?: string; // ISO String for creation timestamp
  authUid?: string; // Firebase Auth UID
  modulePermissions?: Record<string, string[]>; // ex: { 'portal-repasse': ['portal-repasse:view', 'portal-repasse:tickets:view'] }
  accessType?: string; // Ex.: comercial / normal / admin / superadmin — usado para permissionamento futuro
  // Dados oficiais do Perfil (mantidos pelo RH):
  team?: string;            // Equipe (grupo sob um Gestor; um Gestor pode ter várias)
  leaderIdVeneto?: string;  // Gestor pelo idVeneto (ADR 0001, legado); `leader` fica como nome legado
  unitId?: string;          // Unidade da estrutura (ADR 0004): o gestor vem do responsável dela
  managerOverrideIdVeneto?: string; // Gestor fora da regra da estrutura (exceção manual)
  hubHidden?: boolean;
  accessProfileId?: string; // Perfil de acesso próprio (ADR 0005); sem ele, vale o da unidade
  accessOverrides?: AccessOverrides; // Ajustes da pessoa sobre o perfil      // Não aparece no Hub (Pessoas, organograma, aniversários): contas de teste, quem saiu
  birthDate?: string;       // AAAA-MM-DD
  admissionDate?: string;   // AAAA-MM-DD (na Vêneto desde)
  careerHistory?: { position: string; period: string }[];
  // Dados pessoais (editados pela própria pessoa via /api/me/profile):
  bio?: string;
  responsibilities?: string[];
  interests?: string[];
  phone?: string;
  googleChat?: string;
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
  deleteCollaboratorMutation: UseMutationResult<void, Error, string, unknown>;
}

const CollaboratorsContext = createContext<CollaboratorsContextType | undefined>(undefined);
const COLLECTION_NAME = 'collaborators';
const LOG_COLLECTION_NAME = 'collaborator_logs';

const API_PATH = '/api/admin/collaborators';

/** Chamada autenticada às rotas de colaboradores (Admin SDK no servidor). */
const authorizedRequest = async (url: string, init: { method: string; body?: unknown }): Promise<void> => {
  const currentUser = getAuth(getFirebaseApp()).currentUser;
  if (!currentUser) throw new Error('Sessão expirada. Entre novamente para continuar.');

  const token = await currentUser.getIdToken();
  const response = await fetch(url, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? 'Não foi possível concluir a operação.');
  }
};

/**
 * Incrementa `collaboratorTableVersion` pela API: `systemSettings/config` só aceita
 * escrita de super admin nas rules, e o RH (`collaboratorAdminEmails`) também cadastra.
 *
 * Best-effort de propósito: roda depois do colaborador já gravado. Se lançasse, a
 * tela mostraria erro de um cadastro salvo e o RH repetiria — duplicando o registro.
 */
const bumpCollaboratorTableVersion = async (): Promise<void> => {
  try {
    await authorizedRequest(`${API_PATH}/table-version`, { method: 'POST' });
  } catch (error) {
    console.warn('Falha ao atualizar a versão da tabela de colaboradores:', error);
  }
};

/**
 * Campos que o formulário de cadastro edita. Edição e exclusão passam pela API
 * (as rules só deixam super admin escrever em `collaborators` de terceiros), que
 * aceita apenas estes campos — permissões continuam na tela de permissões.
 */
const PROFILE_FIELDS = [
  'idVeneto', 'name', 'email', 'photoURL', 'axis', 'area', 'position',
  'segment', 'leader', 'lideranca', 'city',
  'team', 'leaderIdVeneto', 'birthDate', 'admissionDate', 'careerHistory', 'unitId', 'managerOverrideIdVeneto', 'hubHidden',
] as const satisfies ReadonlyArray<keyof Collaborator>;

const defaultPermissions: CollaboratorPermissions = DEFAULT_PERMISSIONS;

export const CollaboratorsProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

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
        await bumpCollaboratorTableVersion();
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
        await bumpCollaboratorTableVersion();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
    },
  });

  const updateCollaboratorMutation = useMutation<void, Error, { currentData: Collaborator, newData: Omit<Collaborator, 'id'> }>({
    mutationFn: async ({ currentData, newData }) => {
        const changedFields = Object.fromEntries(
          PROFILE_FIELDS
            .filter((field) => newData[field] !== undefined)
            .filter((field) => JSON.stringify(currentData[field]) !== JSON.stringify(newData[field]))
            .map((field) => [field, newData[field]])
        );

        if (Object.keys(changedFields).length > 0) {
            await authorizedRequest(`${API_PATH}?id=${encodeURIComponent(currentData.id)}`, {
              method: 'PATCH',
              body: changedFields,
            });
        }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
      queryClient.invalidateQueries({ queryKey: [LOG_COLLECTION_NAME] });
    },
  });

  const deleteCollaboratorMutation = useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
        await authorizedRequest(`${API_PATH}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
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
    deleteCollaboratorMutation,
  }), [collaborators, isFetching, addCollaboratorMutation, addMultipleCollaboratorsMutation, updateCollaboratorMutation, deleteCollaboratorMutation]);

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
