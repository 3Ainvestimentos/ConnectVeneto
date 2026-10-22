import { cn } from '@/lib/utils';

/**
 * Largura e respiro padrão das páginas do hub. Sem trilha de navegação nem "Voltar": cada página do
 * hub (Início, Publicações, Pessoas e equipes) é um item do menu lateral.
 */
export function HubPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1440px] space-y-6 px-4 py-5 sm:px-6 md:py-6 xl:px-10 xl:py-8', className)}>{children}</div>;
}
