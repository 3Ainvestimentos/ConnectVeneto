
"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
    const { user, loading, isAdmin } = useAuth();
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                // Se não houver usuário e o carregamento estiver concluído, redirecione para o login
                router.replace('/login');
            } else if (!isAdmin) {
                // Redireciona usuários sem nenhuma permissão de admin para o painel principal
                router.replace('/dashboard'); 
            } else {
                setIsAuthorized(true);
            }
        }
    }, [user, loading, isAdmin, router]);

    // Mostra um indicador de carregamento enquanto verifica o status de autenticação
    if (loading || !isAuthorized) {
        return (
            <div className="flex h-[calc(100vh-var(--header-height))] w-full items-center justify-center bg-background">
                <LoadingSpinner />
            </div>
        );
    }
    
    // Se autorizado, renderiza os componentes filhos (a página de admin)
    return <>{children}</>;
}
