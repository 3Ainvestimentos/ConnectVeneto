import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { AvatarTone, Person } from '@/lib/hub-mock/types';

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-24 w-24 text-3xl',
};

// Classes escritas por extenso para o Tailwind gerá-las (o mock em src/lib não entra no `content`).
const TONES: Record<AvatarTone, string> = {
  slate: 'bg-slate-700 text-white',
  sky: 'bg-sky-700 text-white',
  teal: 'bg-teal-700 text-white',
  amber: 'bg-amber-700 text-white',
  violet: 'bg-violet-700 text-white',
  rose: 'bg-rose-700 text-white',
};

export function PersonAvatar({
  person,
  size = 'md',
  link = false,
  className,
}: {
  person: Person;
  size?: keyof typeof SIZES;
  link?: boolean;
  className?: string;
}) {
  const avatar = (
    <span
      title={person.name}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-headline font-bold',
        TONES[person.color],
        SIZES[size],
        className,
      )}
    >
      {person.initials}
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
