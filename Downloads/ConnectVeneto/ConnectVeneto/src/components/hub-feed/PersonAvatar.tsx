import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { HubPerson } from '@/lib/hub/people';
import { initialsOf } from './UserAvatar';

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-24 w-24 text-3xl',
};

// Classes por extenso para o Tailwind gerá-las.
const TONES = ['bg-slate-700', 'bg-sky-700', 'bg-teal-700', 'bg-amber-700', 'bg-violet-700', 'bg-rose-700'];

function toneFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TONES[Math.abs(h) % TONES.length];
}

/** Avatar de uma pessoa do Hub: foto do cadastro ou iniciais com cor estável; `link` leva ao Perfil. */
export function PersonAvatar({
  person,
  size = 'md',
  link = false,
  className,
}: {
  person: Pick<HubPerson, 'id' | 'name' | 'email' | 'photoURL'>;
  size?: keyof typeof SIZES;
  link?: boolean;
  className?: string;
}) {
  const base = cn('inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-headline font-bold text-white', SIZES[size], className);
  const avatar = person.photoURL ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={person.photoURL} alt="" title={person.name} className={cn(base, 'bg-muted object-cover')} referrerPolicy="no-referrer" />
  ) : (
    <span title={person.name} className={cn(base, toneFor(person.email || person.name))}>
      {initialsOf(person.name)}
    </span>
  );
  if (!link) return avatar;
  return (
    <Link
      href={`/pessoas/${person.id}`}
      aria-label={`Ver perfil de ${person.name}`}
      className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {avatar}
    </Link>
  );
}
