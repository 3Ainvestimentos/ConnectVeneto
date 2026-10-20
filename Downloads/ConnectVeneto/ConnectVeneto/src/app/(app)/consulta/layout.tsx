"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useConsultaSession } from '@/hooks/useConsultaLinks';

export default function ConsultaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, permissions, isSuperAdmin } = useAuth();
  const router = useRouter();
  const hasPermission = permissions.canViewConsultaPessoal || isSuperAdmin;

  /** Admin de um tipo de link entra mesmo sem a permissão da página, para administrar. */
  const { data: session, isLoading: sessionLoading } = useConsultaSession();
  const isTypeAdmin = (session?.adminTypeIds.length ?? 0) > 0;
  const deciding = loading || (!!user && !hasPermission && sessionLoading);
  const isAuthorized = !!user && (hasPermission || isTypeAdmin);

  useEffect(() => {
    if (deciding) return;
    if (!user) router.replace('/login');
    else if (!isAuthorized) router.replace('/dashboard');
  }, [deciding, user, isAuthorized, router]);

  if (deciding || !isAuthorized) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] w-full items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex-grow h-[calc(100vh-var(--header-height))]">
      {children}
    </div>
  );
}
