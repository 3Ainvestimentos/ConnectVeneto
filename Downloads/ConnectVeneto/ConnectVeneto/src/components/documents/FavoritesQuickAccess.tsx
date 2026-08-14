"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FavoriteQuickItem {
  id: string;
  label: string;
  onOpen: () => void;
}

interface FavoritesQuickAccessProps {
  items: FavoriteQuickItem[];
}

/**
 * Faixa de acesso rápido aos favoritos: um clique abre o documento, sem pesquisar
 * nem rolar — é o caminho pensado para uso ao vivo, durante a reunião com o cliente.
 */
export function FavoritesQuickAccess({ items }: FavoritesQuickAccessProps) {
  if (items.length === 0) return null;

  return (
    <section className="mb-4 rounded-lg border bg-card p-4" aria-label="Favoritos">
      <div className="mb-3 flex items-center gap-2">
        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
        <h2 className="font-headline text-sm font-semibold">Favoritos</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Button
            key={item.id}
            variant="outline"
            size="sm"
            onClick={item.onOpen}
            className="max-w-[18rem] justify-start font-body"
            title={item.label}
          >
            <span className="truncate">{item.label}</span>
          </Button>
        ))}
      </div>
    </section>
  );
}
