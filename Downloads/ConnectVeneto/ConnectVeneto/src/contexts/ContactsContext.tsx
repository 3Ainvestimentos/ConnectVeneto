"use client";

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { UseMutationResult } from '@tanstack/react-query';
import { WithId } from '@/lib/firestore-service';
import * as z from 'zod';
import { useFirestoreCollection } from '@/hooks/useFirestoreCollection';

export const contactSchema = z.object({
  area: z.string().min(1, "A área é obrigatória."),
  manager: z.string().min(1, "O nome do gestor é obrigatório."),
  slackUrl: z.string().url("A URL do Slack deve ser um link válido."),
  order: z.number().default(0),
});

export type ContactType = WithId<z.infer<typeof contactSchema>>;

interface ContactsContextType {
  contacts: ContactType[];
  loading: boolean;
  addContact: (contact: Omit<ContactType, 'id'>) => Promise<ContactType>;
  updateContact: (contact: Partial<ContactType> & { id: string }) => Promise<void>;
  deleteContactMutation: UseMutationResult<void, Error, string, unknown>;
}

const ContactsContext = createContext<ContactsContextType | undefined>(undefined);
const COLLECTION_NAME = 'contacts';

export const ContactsProvider = ({ children }: { children: ReactNode }) => {
  const { items: rawContacts, loading, addItem, updateItem, deleteItemMutation } =
    useFirestoreCollection<ContactType>(COLLECTION_NAME);

  const contacts = useMemo(() => {
    if (!rawContacts) return [];
    return [...rawContacts].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [rawContacts]);

  const value = useMemo(() => ({
    contacts,
    loading,
    addContact: addItem as (contact: Omit<ContactType, 'id'>) => Promise<ContactType>,
    updateContact: updateItem,
    deleteContactMutation: deleteItemMutation,
  }), [contacts, loading, addItem, updateItem, deleteItemMutation]);

  return (
    <ContactsContext.Provider value={value}>
      {children}
    </ContactsContext.Provider>
  );
};

export const useContacts = (): ContactsContextType => {
  const context = useContext(ContactsContext);
  if (context === undefined) {
    throw new Error('useContacts must be used within a ContactsProvider');
  }
  return context;
};
