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
  /** Imagem vai em <img>: dentro de um iframe ela não respeita o tamanho do diálogo. */
  kind?: "pdf" | "image";
  onClose: () => void;
}

/**
 * Visualizador de PDF e imagem dentro do app — evita trocar de janela no meio da
 * reunião.
 *
 * O PDF usa <iframe> com a URL de download do Firebase Storage, já liberada em
 * `frame-src` na CSP (next.config.ts); a imagem usa <img>, coberta por `img-src`.
 * O botão "Abrir em nova aba" cobre navegadores que se recusam a renderizar PDF
 * embutido.
 */
export function DocumentPreviewDialog({
  title,
  description,
  url,
  kind = "pdf",
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
            {kind === "image" ? (
              <div className="flex h-full w-full flex-1 items-center justify-center overflow-auto rounded-md border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL do Storage com token, fora do loader do next/image. */}
                <img
                  src={url}
                  alt={title}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <iframe
                src={url}
                title={`Visualização de ${title}`}
                className="h-full w-full flex-1 rounded-md border bg-muted"
              />
            )}
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
