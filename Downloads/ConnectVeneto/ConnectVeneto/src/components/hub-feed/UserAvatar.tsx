"use client";

import { useMemo } from 'react';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { normalizeEmail } from '@/lib/email-utils';
import { cn } from '@/lib/utils';

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
} as const;

// Classes por extenso para o Tailwind gerá-las.
const TONES = ['bg-slate-700', 'bg-sky-700', 'bg-teal-700', 'bg-amber-700', 'bg-violet-700', 'bg-rose-700'];

function toneFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TONES[Math.abs(h) % TONES.length];
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Avatar de um colaborador real: foto do cadastro quando houver, senão iniciais com cor estável. */
export function UserAvatar({ email, name, size = 'md', className }: { email: string; name: string; size?: keyof typeof SIZES; className?: string }) {
  const { collaborators } = useCollaborators();
  const photo = useMemo(() => {
    const target = normalizeEmail(email);
    return collaborators.find((c) => normalizeEmail(c.email) === target)?.photoURL || null;
  }, [collaborators, email]);

  const base = cn('inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-headline font-bold text-white', SIZES[size], className);
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={name} title={name} className={cn(base, 'object-cover')} referrerPolicy="no-referrer" />;
  }
  return (
    <span title={name} className={cn(base, toneFor(email))}>
      {initialsOf(name)}
    </span>
  );
}
