
"use client";

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { setDocumentInCollection, deleteDocumentFromCollection, listenToCollection, WithId, updateDocumentInCollection, getDocument, getCollection } from '@/lib/firestore-service';
import * as z from 'zod';
import { formatISO } from 'date-fns';
import { useAuth } from './AuthContext';

// Define a lista de tags permitidas
export const campaignTags = ['Captação', 'ROA', 'Relacionamento', 'Campanhas e Missões', 'Engajamento'] as const;

// Schema for a single Campaign (CTA + Follow-up)
export const campaignSchema = z.object({
  id: z.string().default(() => `campaign_${Date.now()}_${Math.random()}`), // Unique ID for dnd-kit
  ctaMessage: z.string().min(1, "A mensagem de CTA é obrigatória."),
  followUpMessage: z.string().min(1, "A mensagem de acompanhamento é obrigatória."),
  tag: z.enum(campaignTags).default('Relacionamento'),
  status: z.enum(['loaded', 'active', 'completed', 'interrupted']).default('loaded'),
  sentAt: z.string().optional(),
  clickedAt: z.string().optional(),
  followUpClosedAt: z.string().optional(), // Data de fechamento do follow-up
  effectiveAt: z.string().optional(), // Data de quando foi marcada como efetiva
});
export type CampaignType = z.infer<typeof campaignSchema>;

// Main schema for a user's FAB message pipeline.
export const fabMessageSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  pipeline: z.array(campaignSchema).default([]),
  archivedCampaigns: z.array(campaignSchema).default([]),
  activeCampaignIndex: z.number().int().default(0),
  status: z.enum(['ready', 'pending_cta', 'completed', 'not_created']).default('ready'),
  isActive: z.boolean().default(true), // New field to control visibility/activity
  // Timestamps
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export type FabMessageType = WithId<z.infer<typeof fabMessageSchema>>;
export type FabMessagePayload = Partial<Omit<FabMessageType, 'id'>>;

interface FabMessagesContextType {
  fabMessages: FabMessageType[];
  loading: boolean;
  upsertMessageForUser: (userId: string, data: FabMessagePayload) => Promise<void>;
  deleteMessageForUser: (userId: string) => Promise<void>;
  markCampaignAsClicked: (userId: string) => Promise<void>;
  startCampaign: (userId: string) => Promise<void>;
  interruptCampaign: (userId: string) => Promise<void>;
  completeFollowUpPeriod: (userId: string) => Promise<void>;
  archiveIndividualCampaign: (userId: string, campaignId: string) => Promise<void>;
  archiveMultipleCampaigns: (userId: string, campaignIds: string[]) => Promise<void>;
}

const FabMessagesContext = createContext<FabMessagesContextType | undefined>(undefined);
const COLLECTION_NAME = 'fabMessages';

export const FabMessagesProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: fabMessages = [], isFetching } = useQuery<FabMessageType[]>({
    queryKey: [COLLECTION_NAME],
    queryFn: () => getCollection<FabMessageType>(COLLECTION_NAME),
    staleTime: Infinity,
    enabled: !!user,
  });

  const upsertMutation = useMutation<void, Error, { userId: string; data: FabMessagePayload }>({
    mutationFn: async ({ userId, data }) => {
        const existingMessage = fabMessages.find(m => m.userId === userId) || await getDocument<FabMessageType>(COLLECTION_NAME, userId);
        const payload: FabMessagePayload = {
            ...data,
            updatedAt: new Date().toISOString(),
        };
        if (existingMessage && payload.pipeline) {
             payload.pipeline = payload.pipeline.map(newCampaign => {
                const oldCampaign = existingMessage.pipeline.find(c => c.id === newCampaign.id);
                if (oldCampaign && oldCampaign.status === 'completed') {
                    const hasChanged = oldCampaign.ctaMessage !== newCampaign.ctaMessage || oldCampaign.followUpMessage !== newCampaign.followUpMessage;
                    if (hasChanged) {
                        return { ...newCampaign, status: 'loaded' as const, sentAt: undefined, clickedAt: undefined, followUpClosedAt: undefined, effectiveAt: undefined };
                    }
                }
                return newCampaign;
            });
        }
        if (payload.pipeline && payload.pipeline.length > 0) {
            const hasLoadedCampaigns = payload.pipeline.some(c => c.status === 'loaded');
            payload.status = hasLoadedCampaigns ? 'ready' : 'completed';
        } else {
            payload.status = 'not_created';
        }
        return setDocumentInCollection(COLLECTION_NAME, userId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });
  
  React.useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToCollection<FabMessageType>(
      COLLECTION_NAME,
      (newData) => {
        queryClient.setQueryData([COLLECTION_NAME], newData);
      },
      (error) => {
        console.error(`Failed to listen to ${COLLECTION_NAME} collection:`, error);
      }
    );
    return () => unsubscribe();
  }, [queryClient, user]);

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (userId: string) => deleteDocumentFromCollection(COLLECTION_NAME, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const markCampaignAsClickedMutation = useMutation<void, Error, string>({
    mutationFn: async (userId: string) => {
      const message = (await queryClient.getQueryData<FabMessageType[]>([COLLECTION_NAME]))?.find(m => m.userId === userId);
      if (!message || message.status !== 'pending_cta') {
        throw new Error("A campanha não está aguardando um clique.");
      }
      
      const newPipeline = [...message.pipeline];
      const activeCampaignIndex = newPipeline.findIndex(c => c.status === 'active');
      if (activeCampaignIndex === -1) {
          throw new Error("Nenhuma campanha ativa encontrada para marcar como clicada.");
      }
      
      newPipeline[activeCampaignIndex] = {
        ...newPipeline[activeCampaignIndex],
        status: 'completed',
        clickedAt: formatISO(new Date()),
      };
      
      return updateDocumentInCollection(COLLECTION_NAME, userId, {
        status: 'completed', // Campaign is complete, user status reflects this.
        pipeline: newPipeline,
        updatedAt: formatISO(new Date()),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });
  
  const completeFollowUpPeriodMutation = useMutation<void, Error, string>({
    mutationFn: async (userId: string) => {
        const message = (await queryClient.getQueryData<FabMessageType[]>([COLLECTION_NAME]))?.find(m => m.userId === userId);
        if (!message) return; // No message, nothing to do.

        const hasMoreLoaded = message.pipeline.some(c => c.status === 'loaded');
        
        return updateDocumentInCollection(COLLECTION_NAME, userId, {
            status: hasMoreLoaded ? 'ready' : 'completed',
            updatedAt: formatISO(new Date()),
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const archiveMultipleCampaignsMutation = useMutation<void, Error, { userId: string; campaignIds: string[] }>({
    mutationFn: async ({ userId, campaignIds }) => {
        const message = (await queryClient.getQueryData<FabMessageType[]>([COLLECTION_NAME]))?.find(m => m.userId === userId);
        if (!message) throw new Error("Mensagem não encontrada para o usuário");

        const campaignsToArchive = message.pipeline.filter(c => campaignIds.includes(c.id));
        if (campaignsToArchive.length === 0) {
            throw new Error("Nenhuma campanha selecionada foi encontrada no pipeline.");
        }

        const newPipeline = message.pipeline.filter(c => !campaignIds.includes(c.id));
        const newArchived = [...(message.archivedCampaigns || []), ...campaignsToArchive];
        const hasMoreCampaigns = newPipeline.some(c => c.status === 'loaded');

        return updateDocumentInCollection(COLLECTION_NAME, userId, {
            pipeline: newPipeline,
            archivedCampaigns: newArchived,
            status: hasMoreCampaigns ? 'ready' : 'completed',
            updatedAt: formatISO(new Date()),
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });

  const startCampaignMutation = useMutation<void, Error, string>({
      mutationFn: async (userId: string) => {
          const message = (await queryClient.getQueryData<FabMessageType[]>([COLLECTION_NAME]))?.find(m => m.userId === userId);
          if (!message) throw new Error("Campanha não encontrada para este usuário.");
          if (message.status !== 'ready') throw new Error("A campanha não está pronta para ser enviada.");
          
          const campaignToStartIndex = message.pipeline.findIndex(c => c.status === 'loaded');
          if (campaignToStartIndex === -1) {
            throw new Error("Nenhuma campanha carregada para iniciar.");
          }

          const newPipeline = message.pipeline.map((p, index) => 
            index === campaignToStartIndex ? { ...p, status: 'active' as const, sentAt: formatISO(new Date()) } : p
          );
          
          return updateDocumentInCollection(COLLECTION_NAME, userId, {
              pipeline: newPipeline,
              activeCampaignIndex: campaignToStartIndex,
              status: 'pending_cta',
              updatedAt: formatISO(new Date()),
          });
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
      },
  });

  const interruptCampaignMutation = useMutation<void, Error, string>({
    mutationFn: async (userId: string) => {
        const message = (await queryClient.getQueryData<FabMessageType[]>([COLLECTION_NAME]))?.find(m => m.userId === userId);
        if (!message || message.status !== 'pending_cta') {
          console.warn("Attempted to interrupt a campaign that was not in 'pending_cta' state.");
          return;
        }

        const newPipeline = [...message.pipeline];
        const interruptedCampaignIndex = newPipeline.findIndex(c => c.status === 'active');
        
        if (interruptedCampaignIndex !== -1) {
            newPipeline[interruptedCampaignIndex].status = 'interrupted';
        } else {
            console.warn("Could not find an 'active' campaign to interrupt.");
            return; // Exit if no active campaign found
        }

        const hasMoreCampaigns = newPipeline.some(c => c.status === 'loaded');
        
        await updateDocumentInCollection(COLLECTION_NAME, userId, {
            pipeline: newPipeline,
            status: hasMoreCampaigns ? 'ready' : 'completed',
            activeCampaignIndex: 0,
            updatedAt: formatISO(new Date()),
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_NAME] });
    },
  });
  
  const archiveIndividualCampaignMutation = useMutation<void, Error, { userId: string; campaignId: string }>({
    mutationFn: () => {
      throw new Error("Function not implemented.");
    }
  });

  const value = useMemo(() => ({
    fabMessages,
    loading: isFetching,
    upsertMessageForUser: (userId: string, data: FabMessagePayload) => upsertMutation.mutateAsync({ userId, data }),
    deleteMessageForUser: (userId: string) => deleteMutation.mutateAsync(userId),
    markCampaignAsClicked: (userId: string) => markCampaignAsClickedMutation.mutateAsync(userId),
    startCampaign: (userId: string) => startCampaignMutation.mutateAsync(userId),
    interruptCampaign: (userId: string) => interruptCampaignMutation.mutateAsync(userId),
    completeFollowUpPeriod: (userId: string) => completeFollowUpPeriodMutation.mutateAsync(userId),
    archiveIndividualCampaign: (userId: string, campaignId: string) => archiveIndividualCampaignMutation.mutateAsync({ userId, campaignId }),
    archiveMultipleCampaigns: (userId: string, campaignIds: string[]) => archiveMultipleCampaignsMutation.mutateAsync({userId, campaignIds}),
  }), [fabMessages, isFetching, upsertMutation, deleteMutation, markCampaignAsClickedMutation, startCampaignMutation, interruptCampaignMutation, completeFollowUpPeriodMutation, archiveIndividualCampaignMutation, archiveMultipleCampaignsMutation]);

  return (
    <FabMessagesContext.Provider value={value}>
      {children}
    </FabMessagesContext.Provider>
  );
};

export const useFabMessages = (): FabMessagesContextType => {
  const context = useContext(FabMessagesContext);
  if (context === undefined) {
    throw new Error('useFabMessages must be used within a FabMessagesProvider');
  }
  return context;
};
