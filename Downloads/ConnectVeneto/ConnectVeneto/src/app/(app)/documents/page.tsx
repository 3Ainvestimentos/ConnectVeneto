"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DocumentRepositoryClient from "@/components/documents/DocumentRepositoryClient";
import CommercialLibraryClient from "@/components/documents/CommercialLibraryClient";
import { useDocuments } from "@/contexts/DocumentsContext";
import { useAuth } from "@/contexts/AuthContext";
import { venetoRepositoryDocuments } from "@/config/veneto-documentos";
import { mergeStaticAndFirestoreDocuments } from "@/lib/document-repository-utils";

export default function DocumentsPage() {
  const { documents } = useDocuments();
  const { permissions, isSuperAdmin } = useAuth();

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

  const canViewInternal = isSuperAdmin || permissions.canViewDocuments;
  const canViewCommercial =
    isSuperAdmin ||
    permissions.canViewBibliotecaComercial ||
    permissions.canManageBibliotecaComercial;

  // A busca da aba comercial cobre os dois acervos, mas só entrega internos a quem pode vê-los.
  const searchableInternalDocuments = canViewInternal ? mergedDocuments : [];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <PageHeader
        title="Repositório de Documentos"
        description="Materiais internos da Vêneto e o acervo comercial para reuniões com clientes."
      />

      {canViewInternal && canViewCommercial ? (
        // A Biblioteca Comercial abre por padrão: é a tela de uso durante a reunião.
        <Tabs defaultValue="comercial">
          <TabsList className="font-body">
            <TabsTrigger value="comercial">Biblioteca Comercial</TabsTrigger>
            <TabsTrigger value="internos">Documentos internos</TabsTrigger>
          </TabsList>
          <TabsContent value="comercial" className="mt-4">
            <CommercialLibraryClient internalDocuments={searchableInternalDocuments} />
          </TabsContent>
          <TabsContent value="internos" className="mt-4">
            <DocumentRepositoryClient
              initialDocuments={mergedDocuments}
              categories={categories}
              types={types}
            />
          </TabsContent>
        </Tabs>
      ) : canViewCommercial ? (
        <CommercialLibraryClient internalDocuments={searchableInternalDocuments} />
      ) : (
        <DocumentRepositoryClient
          initialDocuments={mergedDocuments}
          categories={categories}
          types={types}
        />
      )}
    </div>
  );
}
