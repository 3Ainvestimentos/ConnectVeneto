"use client";

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { Link as LinkIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  MAX_NEWS_IMAGE_BYTES,
  MAX_NEWS_VIDEO_BYTES,
  NEWS_IMAGE_ACCEPT_ATTRIBUTE,
  NEWS_VIDEO_ACCEPT_ATTRIBUTE,
  type NewsMediaKind,
} from '@/config/news-media';
import { uploadNewsMediaFile, validateNewsMediaFile } from '@/lib/news-media-storage';

type NewsMediaFieldProps = {
  kind: NewsMediaKind;
  label: string;
  /** URL atual (upload ou link externo colado à mão). */
  url: string;
  /** Caminho no Storage — só existe quando a mídia veio de upload. */
  storagePath: string;
  onChange: (value: { url: string; storagePath: string }) => void;
  /** Avisa o pai de cada arquivo enviado, para ele limpar órfãos se a notícia não for salva. */
  onUploaded?: (storagePath: string) => void;
  disabled?: boolean;
  error?: string;
  helperText?: string;
};

const MODE_HINT: Record<NewsMediaKind, string> = {
  image: `PNG, JPG, WEBP ou GIF — até ${Math.floor(MAX_NEWS_IMAGE_BYTES / (1024 * 1024))} MB.`,
  video: `MP4, WEBM ou MOV — até ${Math.floor(MAX_NEWS_VIDEO_BYTES / (1024 * 1024))} MB.`,
};

const ACCEPT: Record<NewsMediaKind, string> = {
  image: NEWS_IMAGE_ACCEPT_ATTRIBUTE,
  video: NEWS_VIDEO_ACCEPT_ATTRIBUTE,
};

/**
 * Campo de mídia de uma notícia: o arquivo pode ser enviado do computador ou a
 * pessoa pode continuar colando um link, como era antes.
 *
 * O upload vai direto do browser para o Firebase Storage (o corpo de requisição da
 * Vercel não comporta vídeo); a permissão é verificada quando a notícia é gravada
 * em /api/admin/news. Um arquivo enviado numa notícia que não chega a ser salva
 * fica órfão — por isso o `onUploaded`, que deixa o pai apagar depois.
 */
export function NewsMediaField({
  kind,
  label,
  url,
  storagePath,
  onChange,
  onUploaded,
  disabled,
  error,
  helperText,
}: NewsMediaFieldProps) {
  const [mode, setMode] = useState<'upload' | 'link'>(storagePath ? 'upload' : 'link');
  const [progress, setProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isUploading = progress !== null;
  const isBusy = !!disabled || isUploading;

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;

    const validationError = validateNewsMediaFile(file, kind);
    if (validationError) {
      toast({ title: 'Arquivo não aceito', description: validationError, variant: 'destructive' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setProgress(0);
    try {
      const result = await uploadNewsMediaFile(file, kind, setProgress);
      onChange({ url: result.downloadUrl, storagePath: result.storagePath });
      onUploaded?.(result.storagePath);
      toast({
        title: kind === 'image' ? 'Imagem enviada' : 'Vídeo enviado',
        description: 'Lembre de salvar a notícia para publicar.',
      });
    } catch (uploadError) {
      toast({
        title: 'Falha no upload',
        description:
          uploadError instanceof Error ? uploadError.message : 'Não foi possível enviar o arquivo.',
        variant: 'destructive',
      });
    } finally {
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearMedia = () => {
    onChange({ url: '', storagePath: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={mode === 'upload' ? 'secondary' : 'ghost'}
            className="h-7 px-2 text-xs"
            onClick={() => setMode('upload')}
            disabled={isBusy}
          >
            <Upload className="mr-1 h-3.5 w-3.5" />
            Enviar arquivo
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'link' ? 'secondary' : 'ghost'}
            className="h-7 px-2 text-xs"
            onClick={() => setMode('link')}
            disabled={isBusy}
          >
            <LinkIcon className="mr-1 h-3.5 w-3.5" />
            Usar link
          </Button>
        </div>
      </div>

      {mode === 'upload' ? (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT[kind]}
            className="hidden"
            onChange={(event) => handleFileSelected(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isUploading
              ? `Enviando… ${progress}%`
              : storagePath
                ? 'Trocar arquivo'
                : 'Escolher arquivo do computador'}
          </Button>
          {isUploading ? <Progress value={progress ?? 0} className="h-1.5" /> : null}
          <p className="text-xs text-muted-foreground">{MODE_HINT[kind]}</p>
        </div>
      ) : (
        <Input
          value={url}
          onChange={(event) => onChange({ url: event.target.value, storagePath: '' })}
          placeholder="https://..."
          disabled={isBusy}
        />
      )}

      {url ? (
        <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-2">
          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded bg-black">
            {kind === 'image' ? (
              // `unoptimized` no next.config: qualquer https serve, inclusive links externos.
              <Image src={url} alt={label} fill className="object-cover" />
            ) : (
              <video src={url} className="h-full w-full object-cover" muted playsInline />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">
              {storagePath ? 'Arquivo enviado' : 'Link externo'}
            </p>
            <p className={cn('truncate text-xs text-muted-foreground')} title={url}>
              {storagePath ? storagePath.split('/').pop() : url}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={clearMedia}
            disabled={isBusy}
            title="Remover"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ) : null}

      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
