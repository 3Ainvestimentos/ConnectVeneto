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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { typedLinkSchema, type Audience, type ConsultaLink } from '@/config/consulta-links';
import type { TypedLinkDraft } from '@/hooks/useConsultaLinks';
import { AudiencePicker } from './AudiencePicker';

const EMPTY_AUDIENCE: Audience = { everyone: false, areas: [], teams: [], emails: [] };

const withProtocol = (value: string) => {
  const url = value.trim();
  return url && !/^[a-z][a-z0-9+.-]*:/i.test(url) ? `https://${url}` : url;
};

type TypedLinkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  typeName: string;
  /** Link em edição; ausente = criar. O tipo (Individual/Compartilhado) não muda depois de criado. */
  editing: ConsultaLink | null;
  onSubmit: (draft: TypedLinkDraft) => Promise<void>;
};

export function TypedLinkDialog({ open, onOpenChange, typeName, editing, onSubmit }: TypedLinkDialogProps) {
  const [kind, setKind] = useState<TypedLinkDraft['kind']>('individual');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [audience, setAudience] = useState<Audience>(EMPTY_AUDIENCE);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(editing?.kind === 'shared' ? 'shared' : 'individual');
    setTitle(editing?.title ?? '');
    setDescription(editing?.description ?? '');
    setUrl(editing?.url ?? '');
    setAudience(editing?.audience ?? EMPTY_AUDIENCE);
    setError(null);
  }, [open, editing]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const draft = kind === 'shared'
      ? { kind, title, description, url: withProtocol(url), audience }
      : { kind, title, description };
    const parsed = typedLinkSchema.safeParse(draft);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar link de ${typeName}` : `Novo link de ${typeName}`}</DialogTitle>
            <DialogDescription>
              {kind === 'individual'
                ? 'Só quem tiver URL cadastrada vê este link. Depois de salvar, adicione as pessoas e a URL de cada uma.'
                : 'Todo o público vê a mesma URL.'}
            </DialogDescription>
          </DialogHeader>

          {!editing && (
            <RadioGroup value={kind} onValueChange={(value) => setKind(value as TypedLinkDraft['kind'])} className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm has-[:checked]:border-primary">
                <RadioGroupItem value="individual" className="mt-0.5" />
                <span>
                  <span className="block font-medium">Individual</span>
                  <span className="text-xs text-muted-foreground">Mesmo nome, URL própria — só para quem você adicionar</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm has-[:checked]:border-primary">
                <RadioGroupItem value="shared" className="mt-0.5" />
                <span>
                  <span className="block font-medium">Compartilhado</span>
                  <span className="text-xs text-muted-foreground">A mesma URL para todos do público</span>
                </span>
              </label>
            </RadioGroup>
          )}

          <div className="space-y-2">
            <Label htmlFor="typed-title">Nome</Label>
            <Input id="typed-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Planilha MESA" maxLength={120} />
          </div>

          {kind === 'shared' && (
            <div className="space-y-2">
              <Label htmlFor="typed-url">Endereço</Label>
              <Input
                id="typed-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => setUrl(withProtocol(url))}
                placeholder="https://..."
                autoComplete="off"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="typed-description">Descrição (opcional)</Label>
            <Textarea id="typed-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={300} />
          </div>

          {kind === 'shared' && (
            <div className="space-y-2">
              <Label>Público</Label>
              <AudiencePicker value={audience} onChange={setAudience} />
            </div>
          )}

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
