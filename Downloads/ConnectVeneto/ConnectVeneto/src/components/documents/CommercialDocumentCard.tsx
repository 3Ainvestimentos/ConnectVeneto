"use client";

import { useState } from "react";
import {
  BookOpen,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FileType,
  Headphones,
  Link2,
  Pencil,
  Presentation,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FavoriteToggleButton } from "@/components/documents/FavoriteToggleButton";
import { formatFileSize } from "@/config/biblioteca-comercial";
import type { UnifiedDocument } from "@/lib/document-search";
import { cn } from "@/lib/utils";

interface DocumentResultCardProps {
  document: UnifiedDocument;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpen: (document: UnifiedDocument) => void;
  /** Ações de gestão só existem para documentos comerciais. */
  canManage: boolean;
  onEdit?: (document: UnifiedDocument) => void;
  onDelete?: (document: UnifiedDocument) => void;
  className?: string;
}

const KIND_ICON = {
  pdf: { Icon: FileType, className: "text-red-500" },
  ppt: { Icon: Presentation, className: "text-orange-500" },
  audio: { Icon: Headphones, className: "text-violet-500" },
  doc: { Icon: FileText, className: "text-blue-500" },
  sheet: { Icon: FileSpreadsheet, className: "text-green-600" },
  form: { Icon: FileText, className: "text-muted-foreground" },
  page: { Icon: BookOpen, className: "text-muted-foreground" },
  link: { Icon: Link2, className: "text-sky-600" },
} as const;

const KIND_LABEL: Record<UnifiedDocument["kind"], string> = {
  pdf: "PDF",
  ppt: "Apresentação",
  audio: "Áudio",
  doc: "Documento",
  sheet: "Planilha",
  form: "Formulário",
  page: "Página interna",
  link: "Link",
};

export function CommercialDocumentCard({
  document,
  isFavorite,
  onToggleFavorite,
  onOpen,
  canManage,
  onEdit,
  onDelete,
  className,
}: DocumentResultCardProps) {
  const [showPlayer, setShowPlayer] = useState(false);

  const isCommercial = document.segment === "commercial";
  const isInlineAudio = document.kind === "audio" && document.sourceType === "upload";
  const isInlinePdf = document.kind === "pdf" && document.sourceType === "upload";
  const isInternalPage = !!document.internalPath;

  // Fallback: um `kind` inesperado (documento antigo, dado manual) não pode derrubar a grade toda.
  const { Icon, className: iconClassName } = KIND_ICON[document.kind] ?? KIND_ICON.link;

  const actionLabel = isInternalPage
    ? "Abrir página"
    : isInlinePdf
      ? "Visualizar"
      : isInlineAudio
        ? showPlayer
          ? "Fechar player"
          : "Ouvir"
        : document.sourceType === "upload"
          ? "Baixar"
          : "Abrir link";

  const ActionIcon = isInternalPage
    ? BookOpen
    : isInlineAudio
      ? Headphones
      : document.sourceType === "upload"
        ? Download
        : ExternalLink;

  const handleAction = () => {
    // Áudio enviado ao Storage toca no próprio card; o resto vai pelo handler do pai.
    if (isInlineAudio) {
      setShowPlayer((current) => !current);
      if (!showPlayer) onOpen(document);
      return;
    }
    onOpen(document);
  };

  const sizeLabel = document.sizeBytes
    ? formatFileSize(document.sizeBytes)
    : document.sizeLabel && !["—", "-", ""].includes(document.sizeLabel.trim())
      ? document.sizeLabel
      : null;

  return (
    <Card className={cn("flex flex-col shadow-sm transition-shadow hover:shadow-md", className)}>
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <div className="pt-0.5">
            <Icon className={cn("h-5 w-5", iconClassName)} />
          </div>
          <h3 className="flex-1 font-headline text-base font-semibold leading-tight">
            {document.title}
          </h3>
          <FavoriteToggleButton
            isFavorite={isFavorite}
            onToggle={onToggleFavorite}
            documentLabel={document.title}
            className="-mr-2 -mt-2 shrink-0"
          />
        </div>

        {document.description && (
          <p className="line-clamp-3 font-body text-sm text-muted-foreground">
            {document.description}
          </p>
        )}

        {(document.tags.length > 0 || !isCommercial) && (
          <div className="flex flex-wrap gap-1.5">
            {/* Deixa claro de qual acervo veio o resultado, já que a busca cobre os dois. */}
            {!isCommercial && (
              <Badge variant="outline" className="font-body text-xs">
                Interno{document.category ? ` · ${document.category}` : ""}
              </Badge>
            )}
            {document.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-body text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {showPlayer && isInlineAudio && (
          <audio
            controls
            autoPlay
            src={document.downloadUrl}
            className="w-full"
            aria-label={`Áudio: ${document.title}`}
          />
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="font-body text-xs text-muted-foreground">
            {KIND_LABEL[document.kind] ?? "Documento"}
            {sizeLabel ? ` · ${sizeLabel}` : ""}
          </span>
          <div className="flex items-center gap-1">
            {isCommercial && canManage && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(document)}
                aria-label={`Editar ${document.title}`}
                title="Editar"
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
            {isCommercial && canManage && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(document)}
                aria-label={`Excluir ${document.title}`}
                title="Excluir"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleAction} className="font-body">
              <ActionIcon className="mr-1.5 h-4 w-4" />
              {actionLabel}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
