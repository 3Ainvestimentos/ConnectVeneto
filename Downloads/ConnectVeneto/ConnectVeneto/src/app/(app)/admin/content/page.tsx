
"use client";

import React, { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ManageDocuments } from '@/components/admin/ManageDocuments';
import AdminGuard from '@/components/auth/AdminGuard';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { ManageNews } from '@/components/admin/ManageNews';
import { ManageQuickLinks } from '@/components/admin/ManageQuickLinks';
import { ManageNewsletter } from '@/components/admin/ManageNewsletter';
import { ManageContacts } from '@/components/admin/ManageContacts';

export default function AdminContentPage() {
    const [activeTab, setActiveTab] = useState("news");
    const { isSuperAdmin } = useAuth();

    return (
        <AdminGuard>
            <div className="space-y-6 p-6 md:p-8 admin-panel">
                <PageHeader 
                    title="Gerenciamento de Conteúdo"
                    description="Gerencie as informações dinâmicas da intranet."
                />
                {!isSuperAdmin ? (
                    <Alert variant="destructive" className="font-body">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle>Alterações exigem super administrador</AlertTitle>
                        <AlertDescription>
                            Ler o painel pode ser possível com permissões de colaborador, mas gravar no Firestore (documentos, links, etc.) só é permitido se o seu e-mail constar em
                            {" "}
                            <code className="rounded bg-muted px-1 text-xs">superAdminEmails</code>
                            {" "}no documento
                            {" "}
                            <code className="rounded bg-muted px-1 text-xs">systemSettings/config</code>
                            , coincidindo com o e-mail da conta Google.
                        </AlertDescription>
                    </Alert>
                ) : null}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                        <TabsTrigger value="news">Notícias</TabsTrigger>
                        <TabsTrigger value="documents">Documentos</TabsTrigger>
                        <TabsTrigger value="quicklinks">Links Rápidos</TabsTrigger>
                        <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
                        <TabsTrigger value="contacts">Contatos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="news">
                        <ManageNews />
                    </TabsContent>
                    <TabsContent value="documents">
                        <ManageDocuments />
                    </TabsContent>
                    <TabsContent value="quicklinks">
                        <ManageQuickLinks />
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
