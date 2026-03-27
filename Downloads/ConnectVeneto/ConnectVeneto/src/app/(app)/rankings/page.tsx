
"use client";

import React, { useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRankings } from '@/contexts/RankingsContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Award } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getCollaboratorUserId, useCollaborators } from '@/contexts/CollaboratorsContext';
import { findCollaboratorByEmail } from '@/lib/email-utils';

function RankingsPageContent() {
    const { rankings, loading } = useRankings();
    const { user } = useAuth();
    const { collaborators } = useCollaborators();

    const visibleRankings = useMemo(() => {
        if (!user || loading) return [];
        const currentUser = findCollaboratorByEmail(collaborators, user.email);
        if (!currentUser) return [];

        return rankings.filter(ranking => {
            if (ranking.recipientIds.includes('all')) {
                return true;
            }
            return ranking.recipientIds.includes(getCollaboratorUserId(currentUser) || '');
        });
    }, [rankings, user, collaborators, loading]);


    if (loading) {
        return (
            <div className="space-y-4 flex-grow flex flex-col">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="flex-grow w-full" />
            </div>
        )
    }

    if (visibleRankings.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64">
                <Award className="h-12 w-12 mb-4" />
                <h2 className="text-xl font-semibold text-foreground">Nenhum Documento Disponível</h2>
                <p>Nenhum documento de ranking ou campanha foi liberado para você no momento.</p>
            </div>
        )
    }

    return (
        <Tabs defaultValue={visibleRankings[0]?.id} className="w-full flex-grow flex flex-col">
            <PageHeader
                title="Rankings e Campanhas"
                description="Acompanhe os resultados e materiais das campanhas vigentes."
                actions={
                    <TabsList>
                        {visibleRankings.map(ranking => (
                            <TabsTrigger key={ranking.id} value={ranking.id}>{ranking.name}</TabsTrigger>
                        ))}
                    </TabsList>
                }
            />
            <div className="flex-grow">
                {visibleRankings.map(ranking => (
                    <TabsContent key={ranking.id} value={ranking.id} className="w-full h-full m-0">
                         <iframe
                            src={`${ranking.pdfUrl}#view=fitH`}
                            title={ranking.name}
                            className="w-full h-full border-0 rounded-md"
                        />
                    </TabsContent>
                ))}
            </div>
        </Tabs>
    );
}


export default function RankingsPage() {
    const { permissions, loading } = useAuth();
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = React.useState(false);

    React.useEffect(() => {
        if (!loading) {
            if (!permissions.canViewRankings) {
                router.replace('/dashboard');
            } else {
                setIsAuthorized(true);
            }
        }
    }, [loading, permissions, router]);


    if (loading || !isAuthorized) {
        return (
            <div className="flex h-[calc(100vh-var(--header-height))] w-full items-center justify-center bg-background">
                <LoadingSpinner />
            </div>
        );
    }
    
    return (
        <div className="p-6 md:p-8 flex flex-col h-full">
            <RankingsPageContent />
        </div>
    );
}
