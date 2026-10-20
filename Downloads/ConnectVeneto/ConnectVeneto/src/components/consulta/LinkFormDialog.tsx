"use client";

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { linkFieldsSchema } from '@/config/consulta-links';
import type { LinkDraft } from '@/hooks/useConsultaLinks';

type LinkFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  initial?: LinkDraft;
  /** Campos extras acima do formulário (ex.: escolha do colaborador, na visão de admin). */
  children?: React.ReactNode;
  /** Validação extra do formulário pai; devolve a mensagem de erro ou null. */
  validateExtra?: () => string | null;
  onSubmit: (draft: LinkDraft) => Promise<void>;
};

const EMPTY: LinkDraft = { title: '', url: '', description: '' };

/** Quem cola "docs.google.com/..." sem protocolo quer dizer https. */
const withProtocol = (value: string) => {
  const url = value.trim();
  return url && !/^[a-z][a-z0-9+.-]*:/i.test(url) ? `https://${url}` : url;
};

export function LinkFormDialog({
  open,
  onOpenChange,
  title,
  description,
  initial,
  children,
  validateExtra,
  onSubmit,
}: LinkFormDialogProps) {
  const [draft, setDraft] = useState<LinkDraft>(initial ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(initial ?? EMPTY);
      setError(null);
    }
  }, [open, initial]);

  const set = (field: keyof LinkDraft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((previous) => ({ ...previous, [field]: event.target.value }));

  const normalizeUrl = () => setDraft((previous) => ({ ...previous, url: withProtocol(previous.url) }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const extraError = validateExtra?.();
    if (extraError) return setError(extraError);

    const parsed = linkFieldsSchema.safeParse({ ...draft, url: withProtocol(draft.url) });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Confira os campos.');

    setSaving(true);
    setError(null);
    try {
      await onSubmit(parsed.data);
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          {children}

          <div className="space-y-2">
            <Label htmlFor="link-url">Endereço</Label>
            <Input
              id="link-url"
              value={draft.url}
              onChange={set('url')}
              onBlur={normalizeUrl}
              placeholder="https://docs.google.com/spreadsheets/..."
              autoComplete="off"
              autoFocus={!children}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-title">Nome</Label>
            <Input id="link-title" value={draft.title} onChange={set('title')} placeholder="Ex.: Planilha de clientes" maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-description">Descrição (opcional)</Label>
            <Textarea
              id="link-description"
              value={draft.description}
              onChange={set('description')}
              rows={2}
              maxLength={300}
              placeholder="Para que serve este link"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
