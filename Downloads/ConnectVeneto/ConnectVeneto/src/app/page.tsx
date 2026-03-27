
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redireciona para a tela de login como ponto de entrada padrão.
    router.replace('/login');
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
       <LoadingSpinner />
    </div>
  );
}
