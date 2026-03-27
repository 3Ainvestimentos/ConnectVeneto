
"use client";

import React from 'react';
import AdminGuard from '@/components/auth/AdminGuard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AllRequestsView } from '@/components/admin/AllRequestsView';
import { WorkflowDefinitionsTab } from '@/components/admin/WorkflowDefinitionsTab';

export default function ManageWorkflowsPage() {
    return (
        <AdminGuard>
            <div className="space-y-6 p-6 md:p-8">
                <PageHeader 
                    title="Gerenciamento de Workflows"
                    description="Crie, gerencie e visualize os processos e solicitações da empresa."
                />
                
                <Tabs defaultValue="definitions" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="definitions">Definições</TabsTrigger>
                        <TabsTrigger value="overview">Histórico Geral</TabsTrigger>
                    </TabsList>
                    <TabsContent value="definitions" className="mt-6">
                        <WorkflowDefinitionsTab />
                    </TabsContent>
                    <TabsContent value="overview" className="mt-6">
                        <AllRequestsView />
                    </TabsContent>
                </Tabs>
            </div>
        </AdminGuard>
    );
}
