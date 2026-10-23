"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface InteractiveHtmlDialogProps {
  title: string;
  description?: string;
  /** URL do .html no Firebase Storage. `null` mantém o diálogo fechado. */
  url: string | null;
  onClose: () => void;
}

/**
 * O que o mini sistema pode fazer dentro do iframe. Fica de fora, de propósito,
 * `allow-same-origin`: sem ele o documento roda numa origem opaca — não lê cookies,
 * localStorage nem a sessão do Firebase de ninguém, e cada abertura começa do zero.
 * `allow-top-navigation` também fica de fora, para o HTML não tirar o usuário do app.
 */
const SANDBOX = "allow-scripts allow-forms allow-modals allow-popups allow-downloads";

/**
 * "Mini instância" de um dashboard/sistema em HTML enviado à Biblioteca Comercial.
 *
 * Cada abertura monta um iframe novo e fechar o diálogo o destrói — o estado não
 * sobrevive entre usos. "Reiniciar" remonta o iframe para voltar ao estado inicial
 * no meio da reunião. O arquivo precisa ser autocontido: scripts e estilos inline
 * ou de CDN; caminhos relativos a outros arquivos não resolvem.
 *
 * O iframe aponta direto para a URL do Storage (liberada em `frame-src` na CSP).
 * Um `srcdoc` herdaria a CSP do Connect e bloquearia os scripts de CDN do arquivo.
 */
export function InteractiveHtmlDialog({ title, description, url, onClose }: InteractiveHtmlDialogProps) {
  const [instance, setInstance] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!url) setIsExpanded(false);
  }, [url]);

  return (
    <Dialog open={!!url} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "flex flex-col gap-3",
          isExpanded ? "h-[100dvh] max-h-[100dvh] w-screen max-w-none rounded-none sm:rounded-none" : "h-[90vh] max-w-6xl"
        )}
      >
        <DialogHeader className="pr-10">
          <DialogTitle className="font-headline">{title}</DialogTitle>
          {description && (
            <DialogDescription className="line-clamp-2 font-body">{description}</DialogDescription>
          )}
        </DialogHeader>

        {url && (
          <>
            <iframe
              key={instance}
              src={url}
              title={`Sistema interativo: ${title}`}
              sandbox={SANDBOX}
              referrerPolicy="no-referrer"
              className="h-full w-full flex-1 rounded-md border bg-white"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="font-body text-xs text-muted-foreground">
                Instância temporária: nada do que for feito aqui fica salvo.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInstance((current) => current + 1)}
                  className="font-body"
                >
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  Reiniciar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExpanded((current) => !current)}
                  className="font-body"
                >
                  {isExpanded ? (
                    <Minimize2 className="mr-1.5 h-4 w-4" />
                  ) : (
                    <Maximize2 className="mr-1.5 h-4 w-4" />
                  )}
                  {isExpanded ? "Reduzir" : "Tela cheia"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
