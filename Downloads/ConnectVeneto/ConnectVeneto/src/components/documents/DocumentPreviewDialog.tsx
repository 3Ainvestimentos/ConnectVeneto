"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DocumentPreviewDialogProps {
  title: string;
  description?: string;
  /** URL do PDF (Storage com token ou link https). `null` mantém o diálogo fechado. */
  url: string | null;
  onClose: () => void;
}

/**
 * Visualizador de PDF dentro do app — evita trocar de janela no meio da reunião.
 *
 * Usa <iframe> com a URL de download do Firebase Storage, já liberada em `frame-src`
 * na CSP (next.config.ts). O botão "Abrir em nova aba" cobre navegadores que se
 * recusam a renderizar PDF embutido.
 */
export function DocumentPreviewDialog({
  title,
  description,
  url,
  onClose,
}: DocumentPreviewDialogProps) {
  return (
    <Dialog open={!!url} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[90vh] max-w-5xl flex-col gap-3">
        <DialogHeader className="pr-10">
          <DialogTitle className="font-headline">{title}</DialogTitle>
          {description && (
            <DialogDescription className="line-clamp-2 font-body">{description}</DialogDescription>
          )}
        </DialogHeader>

        {url && (
          <>
            <iframe
              src={url}
              title={`Visualização de ${title}`}
              className="h-full w-full flex-1 rounded-md border bg-muted"
            />
            <div className="flex justify-end">
              <Button variant="outline" size="sm" asChild className="font-body">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-4 w-4" />
                  Abrir em nova aba
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
