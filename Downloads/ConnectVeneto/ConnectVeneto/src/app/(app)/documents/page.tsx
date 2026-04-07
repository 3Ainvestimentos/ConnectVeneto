"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import DocumentRepositoryClient from "@/components/documents/DocumentRepositoryClient";
import { useDocuments } from "@/contexts/DocumentsContext";
import { venetoRepositoryDocuments } from "@/config/veneto-documentos";
import { mergeStaticAndFirestoreDocuments } from "@/lib/document-repository-utils";

export default function DocumentsPage() {
  const { documents } = useDocuments();

  const mergedDocuments = useMemo(
    () => mergeStaticAndFirestoreDocuments(documents, venetoRepositoryDocuments),
    [documents]
  );

  const categories = useMemo(
    () => Array.from(new Set(mergedDocuments.map((doc) => doc.category))),
    [mergedDocuments]
  );
  const types = useMemo(
    () => Array.from(new Set(mergedDocuments.map((doc) => doc.type))),
    [mergedDocuments]
  );

  return (
    <div className="space-y-6 p-6 md:p-8">
      <PageHeader
        title="Repositório de Documentos"
        description="Materiais fixos da Vêneto e documentos adicionados pelo repositório. Use a pesquisa e os filtros para localizar o que precisa."
      />
      <DocumentRepositoryClient
        initialDocuments={mergedDocuments}
        categories={categories}
        types={types}
      />
    </div>
  );
}
