
"use client";

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import type { Timestamp } from 'firebase/firestore';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { getClientFirestore } from '@/lib/firebase';

export interface Participant {
  email: string | null;
  name: string;
}

export interface Opportunity {
  category: string;
  description: string;
  mentions?: string[]; // Campo antigo (pré-migração)
  clientMentions?: string[]; // Campo novo (pós-migração)
  priority: 'high' | 'medium' | 'low';
  title: string;
}

export interface Criterion {
  feedback: string;
  name: string;
  score: number;
  weight: number;
}

export interface Assessment {
  criteria: Criterion[];
  overall_score: number;
  recommendations: string[];
}

export interface MeetingAnalysis {
  id: string;
  file_name: string;
  updated_at: Timestamp | string;
  participants: Participant[];
  summary: string;
  opportunities: Opportunity[];
  assessment?: Assessment;
  user_email: string;
  created_at?: Timestamp | string;
  file_id?: string;
  gcs_metadata_path?: string;
  gcs_metadata_url?: string;
  meeting_type?: string;
  space_id?: string;
  assessment_completed_at?: Timestamp | string;
  metadata?: {
    chunk_count?: number;
    file_size?: number;
    filename?: string;
    has_assessment?: boolean;
    meeting_type?: string;
    processing_time?: number;
  };
}

interface MeetingAnalysesContextType {
  meetingAnalyses: MeetingAnalysis[];
  loading: boolean;
  getUserAnalyses: (userEmail: string) => MeetingAnalysis[];
}

const MeetingAnalysesContext = createContext<MeetingAnalysesContextType | undefined>(undefined);
const COLLECTION_NAME = 'meeting_analyses';

export const MeetingAnalysesProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Função para buscar análises com filtro por user_email
  const getMeetingAnalyses = async (): Promise<MeetingAnalysis[]> => {
    if (!user?.email) return [];
    
    try {
      const db = getClientFirestore();
      const collectionRef = collection(db, COLLECTION_NAME);
      
      // Adicionar filtro por user_email
      const q = query(collectionRef, where('user_email', '==', user.email));
      const snapshot = await getDocs(q);
      
      const data: MeetingAnalysis[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as MeetingAnalysis);
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching meeting_analyses:`, error);
      throw error;
    }
  };

  const { data: allAnalyses = [], isFetching } = useQuery<MeetingAnalysis[]>({
    queryKey: [COLLECTION_NAME, user?.email],
    queryFn: getMeetingAnalyses,
    staleTime: 5 * 60 * 1000, // 5 minutos
    enabled: !!user?.email,
  });

  React.useEffect(() => {
    if (!user?.email) return;
    
    try {
      const db = getClientFirestore();
      const collectionRef = collection(db, COLLECTION_NAME);
      
      // Criar query com filtro para o listener também
      const q = query(collectionRef, where('user_email', '==', user.email));
      
      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const data: MeetingAnalysis[] = [];
          querySnapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() } as MeetingAnalysis);
          });
          queryClient.setQueryData([COLLECTION_NAME, user.email], data);
        },
        (error) => {
          console.error("Failed to listen to meeting_analyses collection:", error);
        }
      );
      
      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up listener for meeting_analyses:", error);
      return () => {};
    }
  }, [queryClient, user?.email]);

  // Não precisa mais filtrar aqui, já vem filtrado da query
  const meetingAnalyses = useMemo(() => {
    return allAnalyses;
  }, [allAnalyses]);

  const getUserAnalyses = useMemo(() => {
    return (userEmail: string): MeetingAnalysis[] => {
      return allAnalyses.filter(analysis => analysis.user_email === userEmail);
    };
  }, [allAnalyses]);

  const value = useMemo(() => ({
    meetingAnalyses,
    loading: isFetching,
    getUserAnalyses: getUserAnalyses,
  }), [meetingAnalyses, isFetching, getUserAnalyses]);

  return (
    <MeetingAnalysesContext.Provider value={value}>
      {children}
    </MeetingAnalysesContext.Provider>
  );
};

export const useMeetingAnalyses = (): MeetingAnalysesContextType => {
  const context = useContext(MeetingAnalysesContext);
  if (context === undefined) {
    throw new Error('useMeetingAnalyses must be used within a MeetingAnalysesProvider');
  }
  return context;
};
