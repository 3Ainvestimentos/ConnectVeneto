"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Largura e respiro padrão das páginas do hub. */
export function HubPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1440px] space-y-7 px-4 py-6 sm:px-6 md:px-10 md:py-8', className)}>{children}</div>;
}

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Trilha de navegação + "Voltar". O voltar usa o histórico quando a pessoa chegou por dentro do
 * Connect; caso contrário, vai para a página pai da trilha.
 */
// Quantas páginas do hub já abriram nesta sessão do app. Na primeira, "Voltar" vai para a página pai;
// nas seguintes, usa o histórico (a pessoa pode ter vindo de um post, de uma equipe, de outro perfil).
let hubPagesOpened = 0;

export function HubBreadcrumb({ items }: { items: Crumb[] }) {
  const router = useRouter();
  const parent = [...items].reverse().find((c) => c.href);
  useEffect(() => {
    hubPagesOpened += 1;
  }, []);
  const back = () => {
    if (hubPagesOpened > 1) router.back();
    else if (parent?.href) router.push(parent.href);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
      {parent && (
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      )}
      <nav aria-label="Trilha" className="flex min-w-0 flex-wrap items-center gap-1 text-muted-foreground">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <span key={`${c.label}-${i}`} className="inline-flex min-w-0 items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="hover:text-foreground hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className={cn('truncate', last && 'font-medium text-foreground')} aria-current={last ? 'page' : undefined}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
