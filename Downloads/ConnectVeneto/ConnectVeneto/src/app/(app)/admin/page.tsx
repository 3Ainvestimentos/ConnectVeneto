
"use client";

import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ManageCollaborators } from '@/components/admin/ManageCollaborators';
import PermissionsPageContent from '@/components/admin/PermissionsPageContent';
import { MaintenanceMode } from '@/components/admin/MaintenanceMode';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';


export default function AdminPage() {
    const { user, loading, isSuperAdmin, permissions } = useAuth();
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [activeTab, setActiveTab] = useState("collaborators");

    useEffect(() => {
        if (!loading) {
            if (!user) {
                setIsAuthorized(false);
                router.replace('/login');
            } else if (!isSuperAdmin && !permissions.canManageSystem) {
                setIsAuthorized(false);
                router.replace('/dashboard');
            } else {
                setIsAuthorized(true);
            }
        }
    }, [user, loading, isSuperAdmin, permissions.canManageSystem, router]);

    if (loading || !isAuthorized) {
        return (
            <div className="flex h-[calc(100vh-var(--header-height))] w-full items-center justify-center bg-background">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6 md:p-8 overflow-x-hidden">
            <PageHeader 
                title="Administração do Sistema"
                description="Gerencie colaboradores, permissões de acesso e o estado da plataforma."
            />
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="collaborators">Colaboradores</TabsTrigger>
                    <TabsTrigger value="permissions">Permissões</TabsTrigger>
                    <TabsTrigger value="maintenance">Configurações</TabsTrigger>
                </TabsList>
                <TabsContent value="collaborators">
                    <ManageCollaborators />
                </TabsContent>
                <TabsContent value="permissions">
                    <PermissionsPageContent />
                </TabsContent>
                <TabsContent value="maintenance">
                    <MaintenanceMode />
                </TabsContent>
            </Tabs>
        </div>
    );
}
