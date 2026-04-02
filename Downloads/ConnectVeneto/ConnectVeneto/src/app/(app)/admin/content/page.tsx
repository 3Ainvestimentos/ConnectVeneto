
"use client";

import React, { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ManageDocuments } from '@/components/admin/ManageDocuments';
import AdminGuard from '@/components/auth/AdminGuard';
import { ManageMessages } from '@/components/admin/ManageMessages';
import { ManageQuickLinks } from '@/components/admin/ManageQuickLinks';
import { ManagePolls } from '@/components/admin/ManagePolls';
import { ManageRankings } from '@/components/admin/ManageRankings';
import { ManageNewsletter } from '@/components/admin/ManageNewsletter';
import { ManageContacts } from '@/components/admin/ManageContacts';

export default function AdminContentPage() {
    const [activeTab, setActiveTab] = useState("documents");

    return (
        <AdminGuard>
            <div className="space-y-6 p-6 md:p-8 admin-panel">
                <PageHeader 
                    title="Gerenciamento de Conteúdo"
                    description="Gerencie as informações dinâmicas da intranet."
                />
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
                        <TabsTrigger value="documents">Documentos</TabsTrigger>
                        <TabsTrigger value="messages">Mensagens</TabsTrigger>
                        <TabsTrigger value="quicklinks">Links Rápidos</TabsTrigger>
                        <TabsTrigger value="polls">Pesquisas</TabsTrigger>
                        <TabsTrigger value="rankings">Rankings</TabsTrigger>
                        <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
                        <TabsTrigger value="contacts">Contatos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="documents">
                        <ManageDocuments />
                    </TabsContent>
                    <TabsContent value="messages">
                        <ManageMessages />
                    </TabsContent>
                     <TabsContent value="quicklinks">
                        <ManageQuickLinks />
                    </TabsContent>
                    <TabsContent value="polls">
                        <ManagePolls />
                    </TabsContent>
                     <TabsContent value="rankings">
                        <ManageRankings />
                    </TabsContent>
                    <TabsContent value="newsletter">
                        <ManageNewsletter />
                    </TabsContent>
                     <TabsContent value="contacts">
                        <ManageContacts />
                    </TabsContent>
                </Tabs>
            </div>
        </AdminGuard>
    );
}
