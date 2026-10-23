'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useEmbeddedModuleRoute } from '@/hooks/useEmbeddedModuleRoute';

/**
 * Antiga gestão de acessos de um módulo (/{slug}/admin). O acesso aos módulos agora vem do perfil
 * de acesso da equipe e dos ajustes de cada pessoa (ADR 0005), em Administração › Acessos; gravar
 * aqui direto seria desfeito no próximo recálculo.
 */
export default function ModuleAdminPage() {
  const { moduleSlug } = useParams<{ moduleSlug: string }>();
  const state = useEmbeddedModuleRoute(moduleSlug);

  if (state.status === 'not-found') notFound();
  if (state.status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="mx-auto my-16 grid max-w-lg justify-items-center gap-3 rounded-xl border bg-card p-8 text-center">
      <ShieldCheck className="h-8 w-8 text-primary" />
      <h1 className="font-headline text-xl font-semibold">Acesso ao {state.module.label}</h1>
      <p className="text-muted-foreground">
        Quem acessa o módulo, e com quais permissões, agora vem do perfil de acesso da equipe e dos ajustes de cada pessoa.
      </p>
      <Button asChild>
        <Link href="/admin">Abrir Administração › Acessos</Link>
      </Button>
    </div>
  );
}
