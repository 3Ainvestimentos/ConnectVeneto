
"use client";

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { UseMutationResult } from '@tanstack/react-query';
import { WithId } from '@/lib/firestore-service';
import { useFirestoreCollection } from '@/hooks/useFirestoreCollection';

export interface LabType {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  lastModified: string;
  videoUrl: string;
}

interface LabsContextType {
  labs: LabType[];
  loading: boolean;
  addLab: (lab: Omit<LabType, 'id'>) => Promise<WithId<Omit<LabType, 'id'>>>;
  updateLab: (lab: LabType) => Promise<void>;
  deleteLabMutation: UseMutationResult<void, Error, string, unknown>;
}

const LabsContext = createContext<LabsContextType | undefined>(undefined);
const COLLECTION_NAME = 'labs';

export const LabsProvider = ({ children }: { children: ReactNode }) => {
  const { items: labs, loading, addItem, updateItem, deleteItemMutation } =
    useFirestoreCollection<LabType>(COLLECTION_NAME);

  const value = useMemo(() => ({
    labs,
    loading,
    addLab: addItem,
    updateLab: updateItem,
    deleteLabMutation: deleteItemMutation,
  }), [labs, loading, addItem, updateItem, deleteItemMutation]);

  return (
    <LabsContext.Provider value={value}>
      {children}
    </LabsContext.Provider>
  );
};

export const useLabs = (): LabsContextType => {
  const context = useContext(LabsContext);
  if (context === undefined) {
    throw new Error('useLabs must be used within a LabsProvider');
  }
  return context;
};
