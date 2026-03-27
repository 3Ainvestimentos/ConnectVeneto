"use client";

import { PageHeader } from '@/components/layout/PageHeader';
import DocumentRepositoryClient from '@/components/documents/DocumentRepositoryClient';
import { useDocuments } from '@/contexts/DocumentsContext';
import type { DocumentType } from '@/contexts/DocumentsContext';

export default function DocumentsPage() {
  const { documents } = useDocuments();

  // Recalculate categories and types from the context state
  const categories = Array.from(new Set(documents.map(doc => doc.category)));
  const types = Array.from(new Set(documents.map(doc => doc.type)));

  return (
    <div className="space-y-6 p-6 md:p-8">
      <PageHeader 
        title="Repositório de Documentos" 
        description="Encontre e gerencie documentos importantes da empresa."
      />
      <DocumentRepositoryClient initialDocuments={documents} categories={categories} types={types} />
    </div>
  );
}

export type { DocumentType };
