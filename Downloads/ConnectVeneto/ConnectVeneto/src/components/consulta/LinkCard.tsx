"use client";

import React, { useState } from 'react';
import { ExternalLink, Link2, Lock, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { linkHostname, type MyConsultaLink } from '@/config/consulta-links';

/** Ícone do site; se não carregar, cai no ícone genérico de link. */
export function LinkFavicon({ url, className = 'h-5 w-5' }: { url: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const host = url ? linkHostname(url) : '';

  if (failed || !host) return <Link2 className={`${className} text-muted-foreground`} aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`}
      alt=""
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

type LinkCardProps = {
  link: MyConsultaLink;
  /** Nome do tipo que mantém o link (mostrado no cadeado). Ausente = link pessoal. */
  managedBy?: string;
  onEdit?: (link: MyConsultaLink) => void;
  onDelete?: (link: MyConsultaLink) => void;
};

export function LinkCard({ link, managedBy, onEdit, onDelete }: LinkCardProps) {
  const editable = !!(onEdit || onDelete);

  return (
    <div className="group relative flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-start gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={link.url}
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
          <LinkFavicon url={link.url} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-medium text-foreground">{link.title}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {linkHostname(link.url)}
          </span>
          {link.description && (
            <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{link.description}</span>
          )}
        </span>
      </a>

      {editable ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Ações do link ${link.title}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onSelect={() => onEdit(link)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem onSelect={() => onDelete(link)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : managedBy ? (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground" tabIndex={0}>
                <Lock className="h-3.5 w-3.5" aria-label="Link mantido pelos administradores" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {link.kind === 'shared' ? 'Compartilhado' : 'Seu link'} · mantido pelos administradores de {managedBy}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}
