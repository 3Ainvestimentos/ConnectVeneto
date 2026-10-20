"use client";

import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PersonalLinkLibrary } from '@/components/consulta/PersonalLinkLibrary';
import { ConsultaAdminPanel } from '@/components/consulta/ConsultaAdminPanel';
import { useConsultaSession } from '@/hooks/useConsultaLinks';

export default function ConsultaPage() {
  const { data: session, isLoading, error } = useConsultaSession();
  const [tab, setTab] = useState('links');

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background p-4 text-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-10 w-10" />
          <h2 className="text-xl font-semibold text-foreground">Não foi possível carregar seus links</h2>
          <p>{error instanceof Error ? error.message : 'Tente novamente em instantes.'}</p>
        </div>
      </div>
    );
  }

  const canAdmin = session.adminTypeIds.length > 0 || session.isSuperAdmin;

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8">
      <PageHeader
        title="Consulta Pessoal"
        description="Seus links de trabalho em um só lugar: salve os que você usa e acesse os mantidos pelas áreas."
      />

      {canAdmin ? (
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="links">Meus links</TabsTrigger>
            <TabsTrigger value="admin">Administração</TabsTrigger>
          </TabsList>
          <TabsContent value="links">
            <PersonalLinkLibrary session={session} />
          </TabsContent>
          <TabsContent value="admin">
            <ConsultaAdminPanel session={session} />
          </TabsContent>
        </Tabs>
      ) : (
        <PersonalLinkLibrary session={session} />
      )}
    </div>
  );
}
