
"use client";

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { addDocumentToCollection, updateDocumentInCollection, deleteDocumentFromCollection, WithId, listenToCollection, getCollection } from '@/lib/firestore-service';
import * as z from 'zod';
import { useAuth } from './AuthContext';

export const workflowAreaSchema = z.object({
    name: z.string().min(1, "O nome da área é obrigatório."),
    icon: z.string().min(1, "O ícone é obrigatório."),
    storageFolderPath: z.string()
        .min(1, "O caminho da pasta no Storage é obrigatório.")
        .refine(
            (path) => {
                // Validação conservadora: apenas verifica path traversal e valores vazios
                // Não rejeita caminhos existentes que podem ter formatos válidos mas incomuns
                const trimmed = path.trim();
                if (!trimmed || trimmed === '' || trimmed === '.' || trimmed === '..') {
                    return false;
                }
                // Apenas bloqueia path traversal explícito
                if (trimmed.includes('..')) {
                    return false;
                }
                return true;
            },
            {
                message: "Caminho inválido. Não pode estar vazio, conter '..' (path traversal), ou ser apenas '.' ou '..'."
            }
        ),
    workflowOrder: z.array(z.string()).optional(),
});

export type WorkflowArea = WithId<z.infer<typeof workflowAreaSchema>>;

interface WorkflowAreasContextType {
    workflowAreas: WorkflowArea[];
    loading: boolean;
    addWorkflowArea: (area: Omit<WorkflowArea, 'id'>) => Promise<WorkflowArea>;
    updateWorkflowArea: (area: Partial<WorkflowArea> & { id: string }) => Promise<void>;
    deleteWorkflowAreaMutation: UseMutationResult<void, Error, string, unknown>;
}

const WorkflowAreasContext = createContext<WorkflowAreasContextType | undefined>(undefined);
const COLLECTION_NAME = 'workflowAreas';

export const WorkflowAreasProvider = ({ children }: { children: ReactNode }) => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const { data: workflowAreas = [], isFetching } = useQuery<WorkflowArea[]>({
        queryKey: [COLLECTION_NAME],
        queryFn: () => getCollection<WorkflowArea>(COLLECTION_NAME),
        staleTime: Infinity,
        enabled: !!user,
        select: (data) => (data || []).sort((a, b) => (a?.name || '').localeCompare(b?.name || '')),
    });

    React.useEffect(() => {
        if (!user) return;
        const unsubscribe = listenToCollection<WorkflowArea>(
            COLLECTION_NAME,
            (newData) => {
                const sortedData = (newData || []).sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
                queryClient.setQueryData([COLLECTION_NAME], sortedData);
            },
            (error) => {
                console.error("Failed to listen to workflow areas collection:", error);
            }
        );
        return () => unsubscribe();
    }, [queryClient, user]);

    const addWorkflowAreaMutation = useMutation<WithId<Omit<WorkflowArea, 'id'>>, Error, Omit<WorkflowArea, 'id'>>({
        mutationFn: (areaData) => addDocumentToCollection(COLLECTION_NAME, areaData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
        },
    });

    const updateWorkflowAreaMutation = useMutation<void, Error, Partial<WorkflowArea> & { id: string }>({
        mutationFn: (updatedArea) => {
            const { id, ...data } = updatedArea;
            return updateDocumentInCollection(COLLECTION_NAME, id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
        },
    });

    const deleteWorkflowAreaMutation = useMutation<void, Error, string>({
        mutationFn: (id) => deleteDocumentFromCollection(COLLECTION_NAME, id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
        },
    });

    const value = useMemo(() => ({
        workflowAreas,
        loading: isFetching,
        addWorkflowArea: (area: Omit<WorkflowArea, 'id'>) => addWorkflowAreaMutation.mutateAsync(area) as Promise<WorkflowArea>,
        updateWorkflowArea: (area: Partial<WorkflowArea> & { id: string }) => updateWorkflowAreaMutation.mutateAsync(area),
        deleteWorkflowAreaMutation,
    }), [workflowAreas, isFetching, addWorkflowAreaMutation, updateWorkflowAreaMutation, deleteWorkflowAreaMutation]);

    return (
        <WorkflowAreasContext.Provider value={value}>
            {children}
        </WorkflowAreasContext.Provider>
    );
};

export const useWorkflowAreas = (): WorkflowAreasContextType => {
    const context = useContext(WorkflowAreasContext);
    if (context === undefined) {
        throw new Error('useWorkflowAreas must be used within a WorkflowAreasProvider');
    }
    return context;
};
