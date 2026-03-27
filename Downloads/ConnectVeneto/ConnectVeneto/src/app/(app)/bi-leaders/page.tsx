"use client";

import React, { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { findCollaboratorByEmail } from '@/lib/email-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function BILeadersPage() {
  const { user, loading: userLoading } = useAuth();
  const { collaborators, loading: collabLoading } = useCollaborators();

  const biLinks = useMemo(() => {
    if (userLoading || collabLoading || !user) return [];
    const currentUser = findCollaboratorByEmail(collaborators, user.email);
    return currentUser?.biLinks || [];
  }, [user, collaborators, userLoading, collabLoading]);

  const [activeTab, setActiveTab] = useState('');

  useMemo(() => {
    if (biLinks.length > 0 && !activeTab) {
      setActiveTab(biLinks[0].url);
    }
  }, [biLinks, activeTab]);

  if (userLoading || collabLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (biLinks.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background p-4 text-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-10 w-10" />
          <h2 className="text-xl font-semibold text-foreground">Painel não configurado</h2>
          <p>Nenhum link de Business Intelligence foi configurado para o seu usuário.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-grow">
        {biLinks.length > 1 && (
            <div className="px-4 py-2 border-b">
                <TabsList>
                {biLinks.map((link) => (
                    <TabsTrigger key={link.url} value={link.url}>{link.name}</TabsTrigger>
                ))}
                </TabsList>
            </div>
        )}
        
        <div className="flex-grow relative">
            {biLinks.map((link) => (
                <TabsContent key={link.url} value={link.url} className="w-full h-full absolute inset-0 m-0 p-0">
                    <iframe
                        title={link.name}
                        width="100%"
                        height="100%"
                        src={link.url}
                        frameBorder="0"
                        allowFullScreen={true}
                        allow="fullscreen; clipboard-read; clipboard-write; autoplay"
                        className="border-0 rounded-none w-full h-full"
                    ></iframe>
                </TabsContent>
            ))}
        </div>
      </Tabs>
    </div>
  );
}
