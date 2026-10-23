
"use client";

import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ManageCollaborators } from '@/components/admin/ManageCollaborators';
import { AccessManager } from '@/components/admin/AccessManager';
import { MaintenanceMode } from '@/components/admin/MaintenanceMode';
import { ManageModules } from '@/components/admin/ManageModules';
import { useAuth } from '@/contexts/AuthContext';
import { useCanEditStructure } from '@/hooks/useOrgUnits';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';


export default function AdminPage() {
    const { user, loading, isSuperAdmin, permissions } = useAuth();
    // RH (admin do cadastro) entra para Colaboradores e Acessos; Módulos e Configurações são de super admin.
    const isCollaboratorAdmin = useCanEditStructure();
    const canEnter = isSuperAdmin || permissions.canManageSystem || isCollaboratorAdmin;
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [activeTab, setActiveTab] = useState("collaborators");

    useEffect(() => {
        if (!loading) {
            if (!user) {
                setIsAuthorized(false);
                router.replace('/login');
            } else if (!canEnter) {
                setIsAuthorized(false);
                router.replace('/dashboard');
            } else {
                setIsAuthorized(true);
            }
        }
    }, [user, loading, canEnter, router]);

    if (loading || !isAuthorized) {
        return (
            <div className="flex h-[calc(100vh-var(--header-height))] w-full items-center justify-center bg-background">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4 sm:p-6 md:p-8 overflow-x-hidden">
            <PageHeader 
                title="Administração do Sistema"
                description="Colaboradores, acessos por perfil e o estado da plataforma."
            />
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="flex h-auto w-full flex-wrap justify-start">
                    <TabsTrigger value="collaborators">Colaboradores</TabsTrigger>
                    <TabsTrigger value="permissions">Acessos</TabsTrigger>
                    {isSuperAdmin && <TabsTrigger value="modules">Módulos</TabsTrigger>}
                    {isSuperAdmin && <TabsTrigger value="maintenance">Configurações</TabsTrigger>}
                </TabsList>
                <TabsContent value="collaborators">
                    <ManageCollaborators />
                </TabsContent>
                <TabsContent value="permissions">
                    <AccessManager />
                </TabsContent>
                <TabsContent value="modules">
                    <ManageModules />
                </TabsContent>
                <TabsContent value="maintenance">
                    <MaintenanceMode />
                </TabsContent>
            </Tabs>
        </div>
    );
}
