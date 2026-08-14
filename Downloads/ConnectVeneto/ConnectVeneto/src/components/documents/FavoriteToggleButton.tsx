"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FavoriteToggleButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
  /** Nome do documento — entra no rótulo acessível. */
  documentLabel: string;
  className?: string;
}

/**
 * Estrela de favorito. Componente sem estado: quem renderiza a lista chama
 * `useDocumentFavorites` uma única vez e distribui o estado, em vez de um hook por linha.
 */
export function FavoriteToggleButton({
  isFavorite,
  onToggle,
  documentLabel,
  className,
}: FavoriteToggleButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-pressed={isFavorite}
      aria-label={
        isFavorite ? `Remover ${documentLabel} dos favoritos` : `Adicionar ${documentLabel} aos favoritos`
      }
      title={isFavorite ? "Remover dos favoritos" : "Favoritar"}
      className={cn("hover:bg-muted", className)}
    >
      <Star
        className={cn(
          "h-5 w-5",
          isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
        )}
      />
    </Button>
  );
}
