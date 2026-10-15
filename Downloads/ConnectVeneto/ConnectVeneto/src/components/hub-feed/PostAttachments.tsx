"use client";

import { useState } from 'react';
import Image from 'next/image';
import { Download, ExternalLink, FileText, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/hub-mock/media';
import type { Post, PostImage } from '@/lib/hub-mock/types';

/** Imagens enviadas na hora (blob:) não passam pelo otimizador do Next. */
const isLocal = (url: string) => url.startsWith('blob:') || url.startsWith('data:');

function Img({ image, className, sizes }: { image: PostImage; className?: string; sizes: string }) {
  return isLocal(image.url) ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image.url} alt={image.name ?? ''} className={cn('absolute inset-0 h-full w-full object-cover', className)} />
  ) : (
    <Image src={image.url} alt={image.name ?? ''} fill sizes={sizes} className={cn('object-cover', className)} />
  );
}

/** 1 imagem: faixa larga; 2: lado a lado; 3+: grade com "+N". Clique abre em tela cheia. */
export function ImageGallery({ images }: { images: PostImage[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (images.length === 0) return null;
  const shown = images.slice(0, 4);
  const extra = images.length - shown.length;

  return (
    <>
      {images.length === 1 ? (
        <button type="button" onClick={() => setOpen(0)} className="relative block aspect-[2/1] max-h-60 w-full overflow-hidden rounded-lg bg-muted sm:aspect-[3/1]">
          <Img image={images[0]} sizes="(max-width: 1024px) 100vw, 720px" />
        </button>
      ) : (
        <div className={cn('grid gap-1.5 overflow-hidden rounded-lg', images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
          {shown.map((img, i) => (
            <button key={img.url} type="button" onClick={() => setOpen(i)} className="relative aspect-square overflow-hidden bg-muted sm:aspect-[4/3]">
              <Img image={img} sizes="240px" />
              {i === shown.length - 1 && extra > 0 && (
                <span className="absolute inset-0 grid place-items-center bg-black/50 text-xl font-semibold text-white">+{extra}</span>
              )}
            </button>
          ))}
        </div>
      )}
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-4xl border-0 bg-black p-0">
          <DialogTitle className="sr-only">Imagem da publicação</DialogTitle>
          {open !== null && (
            <div className="relative aspect-[4/3] w-full">
              <Img image={images[open]} sizes="900px" className="object-contain" />
            </div>
          )}
          {images.length > 1 && open !== null && (
            <div className="flex justify-center gap-2 p-3">
              {images.map((img, i) => (
                <button key={img.url} type="button" onClick={() => setOpen(i)} aria-label={`Imagem ${i + 1}`} className={cn('h-2 w-2 rounded-full', i === open ? 'bg-white' : 'bg-white/40')} />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function VideoBlock({ video }: { video: NonNullable<Post['video']> }) {
  if (video.kind === 'upload') {
    return <video src={video.url} controls preload="metadata" className="max-h-72 w-full max-w-xl rounded-lg bg-black" />;
  }
  if (video.kind === 'youtube' || video.kind === 'drive') {
    return (
      <div className="relative aspect-video w-full max-w-xl overflow-hidden rounded-lg bg-black">
        <iframe src={video.url} title="Vídeo" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="absolute inset-0 h-full w-full border-0" />
      </div>
    );
  }
  return (
    <a href={video.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted">
      <PlayCircle className="h-8 w-8 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate">{video.name ?? video.url}</span>
      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
    </a>
  );
}

export function FileList({ files }: { files: NonNullable<Post['files']> }) {
  return (
    <ul className="grid gap-1.5">
      {files.map((f) => (
        <li key={f.url}>
          <a href={f.url} download={f.name} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
            <FileText className="h-5 w-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
            {f.size ? <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.size)}</span> : null}
            <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ButtonRow({ buttons }: { buttons: NonNullable<Post['buttons']> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {buttons.map((b, i) => (
        <Button key={`${b.href}-${i}`} asChild variant={i === 0 ? 'default' : 'outline'} className="h-9">
          <a href={b.href} target="_blank" rel="noopener noreferrer">
            {b.label} <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </Button>
      ))}
    </div>
  );
}

