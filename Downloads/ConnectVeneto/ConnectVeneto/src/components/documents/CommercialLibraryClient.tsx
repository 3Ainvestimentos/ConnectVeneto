"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import type { DocumentType } from "@/contexts/DocumentsContext";
import { getCollaboratorUserId, useCollaborators } from "@/contexts/CollaboratorsContext";
import { findCollaboratorByEmail } from "@/lib/email-utils";
import { addDocumentToCollection } from "@/lib/firestore-service";
import {
  isAllowedDocumentInternalPath,
  isSafeRepositoryDownloadUrl,
} from "@/lib/document-repository-utils";
import {
  toUnifiedFromCommercial,
  toUnifiedFromInternal,
  type UnifiedDocument,
} from "@/lib/document-search";
import { toast } from "@/hooks/use-toast";
import { useCommercialDocuments } from "@/hooks/useCommercialDocuments";
import { useDocumentFavorites } from "@/hooks/useDocumentFavorites";
import { useDocumentSearch } from "@/hooks/useDocumentSearch";
import type { CommercialDocument } from "@/config/biblioteca-comercial";
import { CommercialDocumentCard } from "@/components/documents/CommercialDocumentCard";
import { CommercialUploadDialog } from "@/components/documents/CommercialUploadDialog";
import { DocumentPreviewDialog } from "@/components/documents/DocumentPreviewDialog";
import { FavoritesQuickAccess } from "@/components/documents/FavoritesQuickAccess";

interface CommercialLibraryClientProps {
  /** Repositório interno já mesclado (estático + Firestore); vazio sem permissão. */
  internalDocuments: DocumentType[];
}

/**
 * Aba "Comercial" da biblioteca: uma barra de busca que entende descrições em
 * linguagem natural e ordena os cards por aderência, favoritos em acesso rápido e o
 * acervo completo abaixo. A busca cobre também o repositório interno.
 */
export default function CommercialLibraryClient({
  internalDocuments,
}: CommercialLibraryClientProps) {
  const router = useRouter();
  const { user, permissions, isSuperAdmin } = useAuth();
  const { collaborators } = useCollaborators();
  const { documents, loading, createDocument, updateDocument, deleteDocument } =
    useCommercialDocuments();
  const { isFavorite, toggleFavorite } = useDocumentFavorites();

  const [query, setQuery] = useState("");
  const [previewDocument, setPreviewDocument] = useState<UnifiedDocument | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<CommercialDocument | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<UnifiedDocument | null>(null);

  const canManage = isSuperAdmin || permissions.canManageBibliotecaComercial;

  const commercialUnified = useMemo(
    () => documents.map(toUnifiedFromCommercial),
    [documents]
  );

  /** O acervo exibido é o comercial; os internos entram só pela busca. */
  const searchableDocuments = useMemo(
    () => [...commercialUnified, ...internalDocuments.map(toUnifiedFromInternal)],
    [commercialUnified, internalDocuments]
  );

  const { results, isSearching, isRanked, error } = useDocumentSearch(searchableDocuments, query);

  const isSearchActive = query.trim().length >= 2;
  const displayedDocuments = isSearchActive ? results : commercialUnified;

  const logAccess = (document: UnifiedDocument) => {
    const currentUserCollab = findCollaboratorByEmail(collaborators, user?.email);
    if (!user || !currentUserCollab) return;
    void addDocumentToCollection("audit_logs", {
      eventType: "document_download",
      userId: getCollaboratorUserId(currentUserCollab),
      userName: currentUserCollab.name,
      timestamp: new Date().toISOString(),
      details: {
        documentId: document.id,
        documentName: document.title,
        contentId: document.id,
        contentTitle: document.title,
        contentType: document.kind,
        source: "biblioteca_comercial",
        segment: document.segment,
      },
    });
  };

  /**
   * PDF e imagem do Storage abrem no visualizador; áudio toca no card; o resto sai
   * do app.
   */
  const handleOpen = (document: UnifiedDocument) => {
    if (isAllowedDocumentInternalPath(document.internalPath)) {
      logAccess(document);
      router.push(document.internalPath);
      return;
    }

    if (!isSafeRepositoryDownloadUrl(document.downloadUrl)) {
      toast({
        title: "Link inválido",
        description: "Este documento não tem um endereço HTTPS seguro. Avise um administrador.",
        variant: "destructive",
      });
      return;
    }

    logAccess(document);

    if (
      (document.kind === "pdf" || document.kind === "image") &&
      document.sourceType === "upload"
    ) {
      setPreviewDocument(document);
      return;
    }
    if (document.kind === "audio" && document.sourceType === "upload") {
      return;
    }
    window.open(document.downloadUrl, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async () => {
    if (!pendingDeletion) return;
    try {
      await deleteDocument(pendingDeletion.id);
      toast({ title: "Documento excluído" });
    } catch (caught) {
      toast({
        title: "Falha ao excluir",
        description: caught instanceof Error ? caught.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setPendingDeletion(null);
    }
  };

  const favoriteItems = searchableDocuments
    .filter((document) => isFavorite(document.segment, document.id))
    .map((document) => ({
      id: document.key,
      label: document.title,
      onOpen: () => handleOpen(document),
    }));

  const renderCard = (document: UnifiedDocument) => (
    <CommercialDocumentCard
      key={document.key}
      document={document}
      isFavorite={isFavorite(document.segment, document.id)}
      onToggleFavorite={() => void toggleFavorite(document.segment, document.id)}
      onOpen={handleOpen}
      canManage={canManage}
      onEdit={(target) => {
        const original = documents.find((item) => item.id === target.id);
        if (!original) return;
        setEditingDocument(original);
        setUploadOpen(true);
      }}
      onDelete={setPendingDeletion}
    />
  );

  return (
    <div className="space-y-4">
      <FavoritesQuickAccess items={favoriteItems} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xl">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Descreva o material: “lâmina do fundo de crédito privado”"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar documentos por descrição"
            className="pl-10 pr-10 font-body"
          />
          {isSearching ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : (
            query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )
          )}
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setEditingDocument(null);
              setUploadOpen(true);
            }}
            className="font-body"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Adicionar documento
          </Button>
        )}
      </div>

      {isSearchActive && (
        <p className="flex items-center gap-1.5 font-body text-sm text-muted-foreground">
          {isRanked && <Sparkles className="h-3.5 w-3.5 text-primary" />}
          {displayedDocuments.length === 0
            ? "Nenhum documento encontrado. Tente descrever de outro jeito."
            : `${displayedDocuments.length} ${
                displayedDocuments.length === 1 ? "documento" : "documentos"
              }${isRanked ? ", em ordem de aderência ao que você pediu" : ""}`}
          {error && " · busca por IA indisponível, exibindo correspondência por texto"}
        </p>
      )}

      {loading && documents.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : displayedDocuments.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedDocuments.map(renderCard)}
        </div>
      ) : (
        !isSearchActive && (
          <div className="py-12 text-center">
            <FolderOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-headline text-xl font-semibold text-muted-foreground">
              A Biblioteca Comercial ainda está vazia.
            </p>
            <p className="font-body text-muted-foreground">
              {canManage
                ? "Use “Adicionar documento” para publicar o primeiro material."
                : "Peça a um gestor da biblioteca para publicar os materiais."}
            </p>
          </div>
        )
      )}

      <DocumentPreviewDialog
        title={previewDocument?.title ?? ""}
        description={previewDocument?.description}
        url={previewDocument?.downloadUrl ?? null}
        kind={previewDocument?.kind === "image" ? "image" : "pdf"}
        onClose={() => setPreviewDocument(null)}
      />

      <CommercialUploadDialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) setEditingDocument(null);
        }}
        editing={editingDocument}
        onCreate={createDocument}
        onUpdate={updateDocument}
      />

      <AlertDialog
        open={!!pendingDeletion}
        onOpenChange={(open) => !open && setPendingDeletion(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline">Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              “{pendingDeletion?.title}” sai da biblioteca para todos os usuários
              {pendingDeletion?.sourceType === "upload" ? " e o arquivo é apagado" : ""}. Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} className="font-body">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
